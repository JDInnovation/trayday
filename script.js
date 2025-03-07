// script.js
import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  db 
} from './firebase-config.js';

import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function() {
  // Variável para o usuário autenticado via Firebase
  let currentUser = null;
  // sessionHistory para sessões de scalping (já encerradas)
  let sessionHistory = [];
  // Variável para cancelar o listener em tempo real, se necessário
  let unsubscribeSessions = null;

  // Dummy articles (não usados nesta nova versão)
  const dummyArticles = [
    {
      id: 1,
      author: "CryptoGuru",
      title: "Bitcoin Breaks New High",
      date: "April 1, 2025",
      category: "noticia",
      excerpt: "Bitcoin reaches an unprecedented all-time high as global interest surges.",
      thumbnail: "thumb1.jpg",
      content: "In a remarkable turn of events, Bitcoin has reached a new all-time high, attracting investors worldwide."
    },
    {
      id: 2,
      author: "BlockchainExpert",
      title: "ETH: The Future of Smart Contracts",
      date: "March 28, 2025",
      category: "análises",
      excerpt: "Ethereum continues to lead the way in smart contract innovation.",
      thumbnail: "thumb2.jpg",
      content: "Ethereum remains at the forefront of blockchain technology with constant upgrades."
    },
    {
      id: 3,
      author: "TraderPro",
      title: "Scalping Strategies in Volatile Markets",
      date: "April 3, 2025",
      category: "informação",
      excerpt: "Scalping can be highly profitable if executed with precision.",
      thumbnail: "thumb3.jpg",
      content: "Scalping, a strategy focused on frequent small gains, is gaining traction in volatile markets."
    }
  ];

  // Variáveis para a sessão de scalping
  let sessionStartTime;
  let sessionTimerInterval;
  let sessionData = {
    initialBank: 0,
    type: "normal", // soft, normal, aggressive
    trades: [],
    riskPerSession: 0,
    maxTrades: 0,
    objectivePercent: 0
  };

  // Variáveis para gráficos
  let performanceChart;
  let resultsChart;

  // Mapeamento de ícones para o menu (novo menu)
  const iconMap = {
    profile: '<i class="fas fa-user menu-icon"></i>',
    accounts: '<i class="fas fa-wallet menu-icon"></i>',
    scalping: '<i class="fas fa-chart-line menu-icon"></i>',
    strategies: '<i class="fas fa-lightbulb menu-icon"></i>',
    calculators: '<i class="fas fa-calculator menu-icon"></i>',
    login: '<i class="fas fa-sign-in-alt menu-icon"></i>'
  };

  // Atualiza o menu
  function updateMenu() {
    const menuLinks = document.getElementById("menuLinks");
    menuLinks.innerHTML = "";
    let items = [];
    if (currentUser) {
      items = [
        { hash: "#profile", label: "Profile", key: "profile" },
        { hash: "#accounts", label: "Accounts", key: "accounts" },
        { hash: "#scalping", label: "Scalping", key: "scalping" },
        { hash: "#strategies", label: "Strategies", key: "strategies" },
        { hash: "#calculators", label: "Calculators", key: "calculators" }
      ];
    } else {
      items = [
        { hash: "#login", label: "Login", key: "login" }
      ];
    }
    items.forEach(item => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = item.hash;
      a.innerHTML = iconMap[item.key] + '<span class="menu-text">' + item.label + "</span>";
      a.setAttribute("data-section", item.hash.substring(1));
      li.appendChild(a);
      menuLinks.appendChild(li);
    });
    updateUserStatus();
  }

  function updateUserStatus() {
    const userStatus = document.getElementById("userStatus");
    if (currentUser) {
      userStatus.innerHTML = `Hello, <strong>${currentUser.email}</strong> | <a href="#" id="logoutLink">Logout</a>`;
      document.getElementById("logoutLink").addEventListener("click", logout);
    } else {
      userStatus.innerHTML = `<a href="#login">Login</a>`;
    }
  }

  // Toggle da sidebar
  document.getElementById("sidebarToggle").addEventListener("click", function() {
    if (window.innerWidth > 768) {
      const sidebar = document.getElementById("sidebar");
      sidebar.classList.toggle("collapsed");
      const logoImg = document.getElementById("logoImg");
      logoImg.src = sidebar.classList.contains("collapsed") ? "traydayicon.png" : "trayday.png";
    }
  });

  // Monitorar autenticação do Firebase
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    updateMenu();
    // Se houver sessão scalping ativa no localStorage, carregue-a mesmo se o usuário não estiver logado
    if (localStorage.getItem("scalpingSession")) {
      const storedSession = JSON.parse(localStorage.getItem("scalpingSession"));
      sessionData = storedSession.sessionData;
      sessionStartTime = new Date(storedSession.sessionStartTime);
      // Inicia o timer se ainda não estiver iniciado
      if (!sessionTimerInterval) {
         sessionTimerInterval = setInterval(updateTimer, 1000);
      }
    }
    if (currentUser) {
      // Outros listeners, se necessário
    } else {
      // Se não logado e tentando acessar páginas protegidas:
      const section = window.location.hash.substring(1);
      if (["profile", "accounts", "scalping", "strategies", "calculators"].includes(section)) {
        window.location.hash = "login";
      }
    }
  });

  // Roteamento
  function loadContent() {
    let section = window.location.hash.substring(1);
    if (!section) section = currentUser ? "profile" : "login";
    if (section.startsWith("account_")) {
      renderAccountDetail(section.substring(8));
      return;
    }
    switch (section) {
      case "login":
        renderLogin();
        break;
      case "signup":
        renderSignUp();
        break;
      case "recover":
        renderRecover();
        break;
      case "profile":
        renderProfile();
        break;
      case "accounts":
        renderAccountsPage();
        break;
      case "scalping":
        renderScalpingPage();
        break;
      case "strategies":
        renderStrategiesPage();
        break;
      case "calculators":
        renderCalculatorsPage();
        break;
      default:
        document.getElementById("mainContent").innerHTML = `<h2>Section not found</h2>`;
    }
    document.querySelectorAll(".sidebar ul li a").forEach(link => {
      link.classList.toggle("active", link.getAttribute("data-section") === section);
    });
  }

  window.addEventListener("hashchange", loadContent);
  updateMenu();
  loadContent();

  // --- FUNÇÕES DE AUTENTICAÇÃO ---
  function renderLogin() {
    const loginHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h2>Login</h2>
          <form class="auth-form">
            <label for="email">Email:</label>
            <input type="email" id="email" placeholder="Digite seu email" required />
            <label for="password">Senha:</label>
            <input type="password" id="password" placeholder="Digite sua senha" required />
            <button type="button" id="loginBtn" class="primary-btn">Login</button>
          </form>
          <div class="auth-actions">
            <button type="button" onclick="window.location.hash='#signup'" class="secondary-btn">Criar Conta</button>
            <button type="button" onclick="window.location.hash='#recover'" class="secondary-btn">Recuperar Senha</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = loginHTML;
    document.getElementById("loginBtn").addEventListener("click", doLogin);
  }
  
  function doLogin() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    if (email === "" || password === "") {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        currentUser = userCredential.user;
        updateMenu();
        window.location.hash = "profile";
      })
      .catch((error) => {
        alert("Erro ao fazer login: " + error.message);
      });
  }

  function renderSignUp() {
    const signUpHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h2>Criar Conta</h2>
          <form class="auth-form">
            <label for="email">Email:</label>
            <input type="email" id="email" placeholder="Digite seu email" required />
            <label for="password">Senha:</label>
            <input type="password" id="password" placeholder="Digite sua senha" required />
            <button type="button" id="signupBtn" class="primary-btn">Criar Conta</button>
          </form>
          <div class="auth-actions">
            <button type="button" onclick="window.location.hash='#login'" class="secondary-btn">Já tenho conta, Login</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = signUpHTML;
    document.getElementById("signupBtn").addEventListener("click", doSignUp);
  }
  
  function doSignUp() {
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    if (email === "" || password === "") {
      alert("Por favor, preencha todos os campos.");
      return;
    }
    createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        currentUser = userCredential.user;
        updateMenu();
        window.location.hash = "profile";
      })
      .catch((error) => {
        alert("Erro ao criar conta: " + error.message);
      });
  }

  function renderRecover() {
    const recoverHTML = `
      <div class="auth-container">
        <div class="auth-card">
          <h2>Recuperar Senha</h2>
          <form class="auth-form">
            <label for="email">Email:</label>
            <input type="email" id="email" placeholder="Digite seu email" required />
            <button type="button" id="recoverBtn" class="primary-btn">Enviar Recuperação</button>
          </form>
          <div class="auth-actions">
            <button type="button" onclick="window.location.hash='#login'" class="secondary-btn">Voltar para Login</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = recoverHTML;
    document.getElementById("recoverBtn").addEventListener("click", recoverPassword);
  }
  
  function recoverPassword() {
    const email = document.getElementById("email").value.trim();
    if (email === "") {
      alert("Por favor, insira seu email.");
      return;
    }
    sendPasswordResetEmail(auth, email)
      .then(() => {
        alert("Email de recuperação enviado!");
      })
      .catch((error) => {
        alert("Erro ao enviar email de recuperação: " + error.message);
      });
  }

  function logout(e) {
    e.preventDefault();
    signOut(auth)
      .then(() => {
        currentUser = null;
        updateMenu();
        window.location.hash = "login";
      })
      .catch((error) => {
        alert("Erro ao fazer logout: " + error.message);
      });
  }

  // --- PROFILE ---
  function renderProfile() {
    const profileHTML = `
      <h2>My Profile</h2>
      <p><strong>Email:</strong> ${currentUser.email}</p>
      <p>Manage your information and track your activity.</p>
    `;
    document.getElementById("mainContent").innerHTML = profileHTML;
  }

  // --- ACCOUNTS (Swing Trading) ---
  async function renderAccountsPage() {
    if (!currentUser) {
      window.location.hash = "login";
      return;
    }
    const accountsRef = collection(db, "accounts");
    const q = query(accountsRef, where("uid", "==", currentUser.uid));
    const querySnapshot = await getDocs(q);
    let accounts = [];
    querySnapshot.forEach(docSnap => {
      accounts.push({ id: docSnap.id, ...docSnap.data() });
    });
    let html = `<h2>Accounts</h2>`;
    if (accounts.length === 0) {
      html += `<div class="account-card">
                 <p>No trading account found.</p>
                 <button id="createAccountBtn" class="primary-btn">Create Account</button>
               </div>`;
    } else {
      accounts.forEach(acc => {
        html += `<div class="account-card" onclick="window.location.hash='account_${acc.id}'">
                   <h3>${acc.accountName}</h3>
                   <p>Balance: $${acc.currentBalance.toFixed(2)}</p>
                 </div>`;
      });
      html += `<button id="createNewAccountBtn" class="secondary-btn">Create New Account</button>`;
    }
    document.getElementById("mainContent").innerHTML = html;
    if(document.getElementById("createAccountBtn")) {
      document.getElementById("createAccountBtn").addEventListener("click", renderCreateAccountPage);
    }
    if(document.getElementById("createNewAccountBtn")) {
      document.getElementById("createNewAccountBtn").addEventListener("click", renderCreateAccountPage);
    }
  }

  function renderCreateAccountPage() {
    const html = `
      <div class="account-create">
        <h2>Create Trading Account</h2>
        <form id="createAccountForm">
          <label for="accountName">Account Name:</label>
          <input type="text" id="accountName" placeholder="Enter account name" required/>
          <label for="initialBalance">Initial Balance ($):</label>
          <input type="number" id="initialBalance" placeholder="Enter initial balance" required/>
          <button type="button" id="createAccountSubmitBtn" class="primary-btn">Create Account</button>
        </form>
        <button id="backAccountsBtn" class="secondary-btn">Back</button>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = html;
    document.getElementById("createAccountSubmitBtn").addEventListener("click", async function() {
      const accountName = document.getElementById("accountName").value.trim();
      const initialBalance = parseFloat(document.getElementById("initialBalance").value);
      if(!accountName || isNaN(initialBalance) || initialBalance <= 0) {
        alert("Please enter valid values.");
        return;
      }
      try {
        const newAccount = {
          uid: currentUser.uid,
          accountName: accountName,
          initialBalance: initialBalance,
          currentBalance: initialBalance,
          createdTime: new Date(),
          trades: []
        };
        const docRef = await addDoc(collection(db, "accounts"), newAccount);
        window.location.hash = "account_" + docRef.id;
      } catch(err) {
        alert("Error creating account: " + err.message);
      }
    });
    document.getElementById("backAccountsBtn").addEventListener("click", function() {
      window.location.hash = "accounts";
    });
  }

  async function renderAccountDetail(accountId) {
    const docRef = doc(db, "accounts", accountId);
    const docSnap = await getDoc(docRef);
    if(!docSnap.exists()) {
      alert("Account not found.");
      window.location.hash = "accounts";
      return;
    }
    const account = { id: docSnap.id, ...docSnap.data() };
    let html = `
      <div class="account-dashboard">
         <h2>${account.accountName}</h2>
         <p>Initial Balance: $${account.initialBalance.toFixed(2)}</p>
         <p>Current Balance: $${account.currentBalance.toFixed(2)}</p>
         <div class="account-actions">
           <button id="depositBtn" class="primary-btn">Deposit</button>
           <button id="withdrawBtn" class="primary-btn">Withdraw</button>
           <button id="closeAccountBtn" class="secondary-btn">Close Account</button>
           <button id="exportAccountBtn" class="secondary-btn">Export Results</button>
         </div>
         <div class="account-trade-form">
           <h3>Add Swing Trade</h3>
           <select id="tradeType">
             <option value="swing">Trade</option>
             <option value="deposit">Deposit</option>
             <option value="withdrawal">Withdrawal</option>
           </select>
           <label for="tradeValue">Amount ($):</label>
           <input type="number" id="tradeValue" placeholder="Enter amount" required/>
           <button id="addAccountTradeBtn" class="primary-btn">Add Trade</button>
         </div>
         <div class="account-stats">
           <h3>Statistics</h3>
           <div class="stats-cards" id="accountStatsCards"></div>
         </div>
         <div class="account-chart">
           <h3>Balance Over Time</h3>
           <canvas id="accountChart"></canvas>
         </div>
         <div class="account-history">
           <h3>Trade History</h3>
           <div class="filter-options">
             <label for="filterType">Filter by:</label>
             <select id="filterType">
               <option value="trades_4">Last 4 Trades</option>
               <option value="trades_10">Last 10 Trades</option>
               <option value="trades_20">Last 20 Trades</option>
               <option value="trades_40">Last 40 Trades</option>
               <option value="trades_80">Last 80 Trades</option>
               <option value="trades_160">Last 160 Trades</option>
               <option value="days_7">Last 7 Days</option>
               <option value="days_30">Last 30 Days</option>
               <option value="days_90">Last 90 Days</option>
               <option value="days_360">Last 360 Days</option>
             </select>
             <button id="applyFilterBtn" class="secondary-btn">Apply Filter</button>
           </div>
           <div class="table-responsive">
             <table id="accountHistoryTable">
               <thead>
                 <tr>
                   <th>#</th>
                   <th>Type</th>
                   <th>Amount ($)</th>
                   <th>Date/Time</th>
                   <th>Remove</th>
                 </tr>
               </thead>
               <tbody></tbody>
             </table>
           </div>
         </div>
         <button id="backAccountsDetailBtn" class="secondary-btn">Back to Accounts</button>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = html;
    document.getElementById("backAccountsDetailBtn").addEventListener("click", function() {
       window.location.hash = "accounts";
    });
    document.getElementById("depositBtn").addEventListener("click", function() {
       document.getElementById("tradeType").value = "deposit";
    });
    document.getElementById("withdrawBtn").addEventListener("click", function() {
       document.getElementById("tradeType").value = "withdrawal";
    });
    document.getElementById("addAccountTradeBtn").addEventListener("click", async function() {
       const type = document.getElementById("tradeType").value;
       const value = parseFloat(document.getElementById("tradeValue").value);
       if(isNaN(value)) {
         alert("Enter a valid amount.");
         return;
       }
       let tradeValue = value;
       if(type === "withdrawal") tradeValue = -value;
       let updatedTrades = account.trades || [];
       const newTrade = {
          tradeId: updatedTrades.length + 1,
          type: type,
          value: tradeValue,
          date: new Date()
       };
       updatedTrades.push(newTrade);
       const newBalance = account.currentBalance + tradeValue;
       try {
         await updateDoc(doc(db, "accounts", accountId), {
            trades: updatedTrades,
            currentBalance: newBalance
         });
         renderAccountDetail(accountId);
       } catch(err) {
         alert("Error adding trade: " + err.message);
       }
    });
    document.getElementById("closeAccountBtn").addEventListener("click", async function() {
       if(confirm("Are you sure you want to close this account? This action cannot be undone.")) {
         try {
           await deleteDoc(doc(db, "accounts", accountId));
           window.location.hash = "accounts";
         } catch(err) {
           alert("Error closing account: " + err.message);
         }
       }
    });
    document.getElementById("exportAccountBtn").addEventListener("click", function() {
       let exportText = `Account: ${account.accountName}\n`;
       exportText += `Initial Balance: $${account.initialBalance.toFixed(2)}\n`;
       exportText += `Current Balance: $${account.currentBalance.toFixed(2)}\n`;
       exportText += `Trades:\n`;
       (account.trades || []).forEach((t, i) => {
         exportText += `${i+1}. [${t.type}] $${t.value.toFixed(2)} on ${new Date(t.date).toLocaleString()}\n`;
       });
       const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
       const url = URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `${account.accountName}_export.txt`;
       a.click();
       URL.revokeObjectURL(url);
    });
    document.getElementById("applyFilterBtn").addEventListener("click", function() {
       applyAccountFilter(account, accountId);
    });
    renderAccountStats(account);
    renderAccountHistory(account);
    initAccountChart(account);
  }

  async function applyAccountFilter(account, accountId) {
    const filterValue = document.getElementById("filterType").value;
    let filteredTrades = account.trades || [];
    if(filterValue.startsWith("trades_")) {
      const num = parseInt(filterValue.split("_")[1]);
      filteredTrades = filteredTrades.slice(-num);
    } else if(filterValue.startsWith("days_")) {
      const days = parseInt(filterValue.split("_")[1]);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      filteredTrades = filteredTrades.filter(t => new Date(t.date) >= cutoff);
    }
    renderAccountHistory({ ...account, trades: filteredTrades });
  }

  function renderAccountStats(account) {
    const trades = account.trades || [];
    const totalTrades = trades.length;
    const totalGainLoss = trades.reduce((sum, t) => sum + t.value, 0);
    const wins = trades.filter(t => t.value > 0).length;
    const winRate = totalTrades ? ((wins / totalTrades) * 100).toFixed(2) : 0;
    const statsHTML = `
     <div class="stats-card">
       <h3>Total Trades</h3>
       <p>${totalTrades}</p>
     </div>
     <div class="stats-card">
       <h3>Total Gain/Loss</h3>
       <p>$${totalGainLoss.toFixed(2)}</p>
     </div>
     <div class="stats-card">
       <h3>Win Rate</h3>
       <p>${winRate}%</p>
     </div>
    `;
    document.getElementById("accountStatsCards").innerHTML = statsHTML;
  }

  let accountChart;
  function initAccountChart(account) {
    const ctx = document.getElementById("accountChart").getContext("2d");
    let balance = account.initialBalance;
    const labels = ["Start"];
    const dataPoints = [balance];
    (account.trades || []).forEach((t, i) => {
      balance += t.value;
      labels.push(`Trade ${i+1}`);
      dataPoints.push(balance);
    });
    if(accountChart) accountChart.destroy();
    accountChart = new Chart(ctx, {
      type: "line",
      data: {
         labels: labels,
         datasets: [{
            label: "Balance Over Time",
            data: dataPoints,
            borderColor: "rgba(0, 216, 255, 1)",
            backgroundColor: "rgba(0, 216, 255, 0.2)",
            fill: true
         }]
      },
      options: {
         scales: {
            x: { title: { display: true, text: "Trade" } },
            y: { title: { display: true, text: "Balance ($)" }, beginAtZero: true }
         }
      }
    });
  }

  // --- SCALPING (Swing Trading) ---
  function renderScalpingPage() {
    // Verifica se há sessão scalping persistente
    const storedSession = localStorage.getItem("scalpingSession");
    let session = null;
    if (storedSession) {
      session = JSON.parse(storedSession);
      sessionData = session.sessionData;
      sessionStartTime = new Date(session.sessionStartTime);
      if (!sessionTimerInterval) {
         sessionTimerInterval = setInterval(updateTimer, 1000);
      }
    }
    const html = `
      <div class="scalping-container">
        <h2>Scalping</h2>
        <div class="scalping-tabs">
          <button id="scalpSessionTab" class="tab-btn active">Session</button>
          <button id="scalpResultsTab" class="tab-btn">Results</button>
        </div>
        <div id="scalpingContent"></div>
        <button id="newScalpSessionBtn" class="secondary-btn" style="margin-top:20px;">Start New Session</button>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = html;
    document.getElementById("scalpSessionTab").addEventListener("click", () => {
      document.getElementById("scalpSessionTab").classList.add("active");
      document.getElementById("scalpResultsTab").classList.remove("active");
      if (localStorage.getItem("scalpingSession")) {
         renderSessionDashboard();
      } else {
         renderSessionStart();
      }
    });
    document.getElementById("scalpResultsTab").addEventListener("click", () => {
      document.getElementById("scalpResultsTab").classList.add("active");
      document.getElementById("scalpSessionTab").classList.remove("active");
      if (localStorage.getItem("scalpingSession")) {
         renderScalpingResults();
      } else {
         document.getElementById("scalpingContent").innerHTML = "<p>No session data available.</p>";
      }
    });
    document.getElementById("newScalpSessionBtn").addEventListener("click", () => {
      localStorage.removeItem("scalpingSession");
      sessionData = { initialBank: 0, type: "normal", trades: [], riskPerSession: 0, maxTrades: 0, objectivePercent: 0 };
      clearInterval(sessionTimerInterval);
      sessionTimerInterval = null;
      renderSessionStart();
    });
    if (localStorage.getItem("scalpingSession")) {
      renderSessionDashboard();
    } else {
      renderSessionStart();
    }
  }

  function renderSessionStart() {
    const sessionStartHTML = `
      <div class="neon-box">
        <h2>Start Scalping Session</h2>
        <div class="session-form">
          <label for="initialBank">Initial Bank ($):</label>
          <input type="number" id="initialBank" placeholder="e.g., 1000" min="0" />
          <label for="sessionType">Session Type:</label>
          <select id="sessionType">
            <option value="soft">Soft</option>
            <option value="normal">Normal</option>
            <option value="aggressive">Aggressive</option>
          </select>
          <button id="startSessionBtn" class="primary-btn">Start Session</button>
        </div>
        <div class="session-info">
          <h3>Session Guidelines</h3>
          <p>The objective is to capture small gains with controlled risk.</p>
        </div>
      </div>
    `;
    document.getElementById("scalpingContent").innerHTML = sessionStartHTML;
    document.getElementById("startSessionBtn").addEventListener("click", startSession);
  }

  function startSession() {
    const initialBank = parseFloat(document.getElementById("initialBank").value);
    const type = document.getElementById("sessionType").value;
    if (isNaN(initialBank) || initialBank <= 0) {
      alert("Please enter a valid initial bank.");
      return;
    }
    sessionData.initialBank = initialBank;
    sessionData.type = type;
    sessionData.trades = [];
    if (type === "soft") {
      sessionData.riskPerSession = 0.03 * initialBank;
      sessionData.maxTrades = 6;
      sessionData.objectivePercent = 3;
    } else if (type === "normal") {
      sessionData.riskPerSession = 0.06 * initialBank;
      sessionData.maxTrades = 4;
      sessionData.objectivePercent = 5;
    } else if (type === "aggressive") {
      sessionData.riskPerSession = 0.12 * initialBank;
      sessionData.maxTrades = 2;
      sessionData.objectivePercent = 10;
    }
    sessionStartTime = new Date();
    sessionTimerInterval = setInterval(updateTimer, 1000);
    localStorage.setItem("scalpingSession", JSON.stringify({ sessionData, sessionStartTime: sessionStartTime.toISOString() }));
    renderSessionDashboard();
  }

  function updateTimer() {
    const now = new Date();
    const elapsed = new Date(now - sessionStartTime);
    const h = String(elapsed.getUTCHours()).padStart(2, "0");
    const m = String(elapsed.getUTCMinutes()).padStart(2, "0");
    const s = String(elapsed.getUTCSeconds()).padStart(2, "0");
    document.getElementById("session-timer").textContent = `${h}:${m}:${s}`;
  }

  // Função para gerar dados de candlestick (Scalping)
  function generateCandlestickData() {
    let runningBank = sessionData.initialBank;
    const bankValues = [runningBank];
    sessionData.trades.forEach(trade => {
      runningBank += trade.value;
      bankValues.push(runningBank);
    });
    const groupSize = 2;
    const candles = [];
    let startIndex = 0;
    while (startIndex < bankValues.length - 1) {
      const endIndex = Math.min(startIndex + groupSize, bankValues.length - 1);
      const open = bankValues[startIndex];
      const close = bankValues[endIndex];
      const slice = bankValues.slice(startIndex, endIndex + 1);
      const high = Math.max(...slice);
      const low = Math.min(...slice);
      candles.push({
        x: `Group ${Math.floor(startIndex/groupSize)+1}`,
        o: open,
        h: high,
        l: low,
        c: close
      });
      startIndex = endIndex;
    }
    return candles;
  }

  // Inicializa o gráfico de candlestick (Scalping)
  function initCandlestickChart() {
    const candlestickData = generateCandlestickData();
    const ctx = document.getElementById("performanceChart").getContext("2d");
    performanceChart = new Chart(ctx, {
      type: 'candlestick',
      data: {
        datasets: [{
          label: "Performance",
          data: candlestickData
        }]
      },
      options: {
        scales: {
          x: {
            title: { display: true, text: "Trade Group" }
          },
          y: {
            title: { display: true, text: "Bank Value ($)" }
          }
        }
      }
    });
  }

  function updateChart() {
    if (performanceChart) {
      const newData = generateCandlestickData();
      performanceChart.data.datasets[0].data = newData;
      performanceChart.update();
      localStorage.setItem("scalpingSession", JSON.stringify({ sessionData, sessionStartTime: sessionStartTime.toISOString() }));
    }
  }

  function renderSessionDashboard() {
    const worstBalance = sessionData.initialBank - sessionData.riskPerSession;
    const bestBalance = sessionData.initialBank * (1 + sessionData.objectivePercent / 100);
    const dashboardHTML = `
      <div class="dashboard">
        <div class="dashboard-header">
          <h2>Scalping Dashboard</h2>
          <div class="time-display">
            <strong>Time: </strong><span id="session-timer">00:00:00</span>
          </div>
        </div>
        <div class="dashboard-row">
          <div class="dashboard-column">
            <h3>Session Information</h3>
            <p><strong>Initial Bank:</strong> $${sessionData.initialBank.toFixed(2)}</p>
            <p><strong>Max Risk per Session:</strong> $${sessionData.riskPerSession.toFixed(2)}</p>
            <p><strong>Max Trades:</strong> ${sessionData.maxTrades}</p>
            <p><strong>Objective Profit:</strong> ${sessionData.objectivePercent}%</p>
            <p><strong>Current Bank:</strong> $<span id="currentBank">${sessionData.initialBank.toFixed(2)}</span></p>
            <p><strong>Worst-case Balance:</strong> $${worstBalance.toFixed(2)}</p>
            <p><strong>Best-case Balance:</strong> $${bestBalance.toFixed(2)}</p>
          </div>
          <div class="dashboard-column">
            <h3>Statistics</h3>
            <p><strong>Total Trades:</strong> <span id="totalTrades">0</span></p>
            <p><strong>Total Gain/Loss:</strong> $<span id="totalGainLoss">0.00</span></p>
            <p><strong>Accuracy:</strong> <span id="accuracy">0%</span></p>
            <p><strong>Profit/Loss:</strong> <span id="profitPercent">0%</span></p>
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" id="progressFill"></div>
              </div>
              <p id="progressText">Progress: 0%</p>
            </div>
          </div>
        </div>
        <div class="dashboard-row">
          <div class="dashboard-column">
            <h3>Enter Trade</h3>
            <label for="tradeValue">Trade Value ($):</label>
            <input type="number" id="tradeValue" placeholder="e.g., 50 or -30" />
            <button id="addTradeBtn" class="primary-btn">Add Trade</button>
          </div>
          <div class="dashboard-column">
            <h3>Performance Chart</h3>
            <canvas id="performanceChart"></canvas>
          </div>
        </div>
        <div class="dashboard-row">
          <div class="dashboard-column full-width">
            <h3>Trades History</h3>
            <div class="table-responsive">
              <table id="tradesTable">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Value ($)</th>
                    <th>Pct Gain (%)</th>
                    <th>Date/Time</th>
                    <th>Remove</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </div>
        </div>
        <div class="dashboard-row">
          <div class="dashboard-column full-width">
            <button id="endSessionBtn" class="secondary-btn" style="background-color: var(--error-color);">
              End Session
            </button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("scalpingContent").innerHTML = dashboardHTML;
    document.getElementById("addTradeBtn").addEventListener("click", addTrade);
    document.getElementById("endSessionBtn").addEventListener("click", terminateSession);
    initCandlestickChart();
  }

  function addTrade() {
    const value = parseFloat(document.getElementById("tradeValue").value);
    if (isNaN(value)) {
      alert("Enter a valid trade value.");
      return;
    }
    if (sessionData.trades.length >= sessionData.maxTrades) {
      alert("Maximum number of trades reached for this session.");
      return;
    }
    const trade = {
      id: sessionData.trades.length + 1,
      value: value,
      date: new Date()
    };
    sessionData.trades.push(trade);
    updateDashboard();
    document.getElementById("tradeValue").value = "";
  }

  function updateDashboard() {
    const tbody = document.querySelector("#tradesTable tbody");
    tbody.innerHTML = "";
    sessionData.trades.forEach((trade, index) => {
      const pctGain = ((trade.value / sessionData.initialBank) * 100).toFixed(2);
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${trade.id}</td>
        <td>$${trade.value.toFixed(2)}</td>
        <td>${pctGain}%</td>
        <td>${trade.date.toLocaleString()}</td>
        <td><button class="remove-btn" data-index="${index}">X</button></td>
      `;
      tbody.appendChild(row);
    });
    document.querySelectorAll(".remove-btn").forEach(btn => {
      btn.addEventListener("click", function() {
        removeTrade(parseInt(this.getAttribute("data-index")));
      });
    });
    const totalTrades = sessionData.trades.length;
    const totalGainLoss = sessionData.trades.reduce((sum, trade) => sum + trade.value, 0);
    const wins = sessionData.trades.filter(trade => trade.value > 0).length;
    const accuracy = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;
    const currentBank = sessionData.initialBank + totalGainLoss;
    const profitPercent = (((currentBank - sessionData.initialBank) / sessionData.initialBank) * 100).toFixed(2);
    document.getElementById("totalTrades").textContent = totalTrades;
    document.getElementById("totalGainLoss").textContent = totalGainLoss.toFixed(2);
    document.getElementById("accuracy").textContent = accuracy + "%";
    document.getElementById("profitPercent").textContent = profitPercent + "%";
    document.getElementById("currentBank").textContent = currentBank.toFixed(2);
    const progress = Math.min((profitPercent / sessionData.objectivePercent) * 100, 100);
    document.getElementById("progressFill").style.width = progress + "%";
    document.getElementById("progressText").textContent = `Progress: ${progress.toFixed(2)}%`;
    updateChart();
  }

  function removeTrade(index) {
    sessionData.trades.splice(index, 1);
    updateDashboard();
  }

  // Métricas adicionais (Scalping)
  function computeMaxDrawdown() {
    let runningBank = sessionData.initialBank;
    let peak = runningBank;
    let maxDrawdown = 0;
    sessionData.trades.forEach(trade => {
      runningBank += trade.value;
      if (runningBank > peak) peak = runningBank;
      const drawdown = ((peak - runningBank) / sessionData.initialBank) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    return maxDrawdown;
  }

  function computeAverageOscillation() {
    const candles = generateCandlestickData();
    if (candles.length === 0) return 0;
    const totalOscillation = candles.reduce((sum, candle) => sum + (candle.h - candle.l), 0);
    return totalOscillation / candles.length;
  }

  async function terminateSession() {
    if (!confirm("Are you sure you want to end the session?")) return;
    clearInterval(sessionTimerInterval);
    const endTime = new Date();
    const durationMs = endTime - sessionStartTime;
    const d = new Date(durationMs);
    const totalDuration = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:${String(d.getUTCSeconds()).padStart(2, "0")}`;
    const totalTrades = sessionData.trades.length;
    const totalGainLoss = sessionData.trades.reduce((sum, trade) => sum + trade.value, 0);
    const wins = sessionData.trades.filter(trade => trade.value > 0).length;
    const accuracy = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;
    const maxDrawdown = computeMaxDrawdown();
    const avgOscillation = computeAverageOscillation();
    
    const sessionSummary = {
      startTime: sessionStartTime,
      endTime: endTime,
      duration: totalDuration,
      initialBank: sessionData.initialBank,
      totalTrades: totalTrades,
      totalGainLoss: totalGainLoss,
      accuracy: accuracy,
      type: sessionData.type,
      maxDrawdown: maxDrawdown,
      avgOscillation: avgOscillation
    };
    sessionHistory.push(sessionSummary);
    await addDoc(collection(db, "sessions"), {
      uid: currentUser ? currentUser.uid : "guest",
      startTime: sessionSummary.startTime,
      endTime: sessionSummary.endTime,
      duration: sessionSummary.duration,
      initialBank: sessionSummary.initialBank,
      totalTrades: sessionSummary.totalTrades,
      totalGainLoss: sessionSummary.totalGainLoss,
      accuracy: sessionSummary.accuracy,
      type: sessionSummary.type,
      maxDrawdown: sessionSummary.maxDrawdown,
      avgOscillation: sessionSummary.avgOscillation,
      timestamp: new Date()
    });
    localStorage.removeItem("scalpingSession");
    const summaryHTML = `
      <h2>Session Summary</h2>
      <div class="session-summary">
        <p><strong>Start:</strong> ${sessionSummary.startTime.toLocaleString()}</p>
        <p><strong>End:</strong> ${sessionSummary.endTime.toLocaleString()}</p>
        <p><strong>Duration:</strong> ${sessionSummary.duration}</p>
        <p><strong>Initial Bank:</strong> $${sessionSummary.initialBank.toFixed(2)}</p>
        <p><strong>Total Trades:</strong> ${sessionSummary.totalTrades}</p>
        <p><strong>Total Gain/Loss:</strong> $${sessionSummary.totalGainLoss.toFixed(2)}</p>
        <p><strong>Accuracy:</strong> ${sessionSummary.accuracy}%</p>
        <p><strong>Max Drawdown:</strong> ${sessionSummary.maxDrawdown.toFixed(2)}%</p>
        <p><strong>Avg Oscillation:</strong> $${sessionSummary.avgOscillation.toFixed(2)}</p>
      </div>
      <button id="backSessionBtn" class="secondary-btn">Back</button>
      <button id="exportSessionBtn" class="secondary-btn">Export Results</button>
    `;
    document.getElementById("scalpingContent").innerHTML = summaryHTML;
    document.getElementById("backSessionBtn").addEventListener("click", () => {
      document.getElementById("scalpSessionTab").click();
    });
    document.getElementById("exportSessionBtn").addEventListener("click", () => {
      let exportText = `Session Summary:\n`;
      exportText += `Start: ${sessionSummary.startTime.toLocaleString()}\n`;
      exportText += `End: ${sessionSummary.endTime.toLocaleString()}\n`;
      exportText += `Duration: ${sessionSummary.duration}\n`;
      exportText += `Initial Bank: $${sessionSummary.initialBank.toFixed(2)}\n`;
      exportText += `Total Trades: ${sessionSummary.totalTrades}\n`;
      exportText += `Total Gain/Loss: $${sessionSummary.totalGainLoss.toFixed(2)}\n`;
      exportText += `Accuracy: ${sessionSummary.accuracy}%\n`;
      exportText += `Max Drawdown: ${sessionSummary.maxDrawdown.toFixed(2)}%\n`;
      exportText += `Avg Oscillation: $${sessionSummary.avgOscillation.toFixed(2)}\n`;
      const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scalping_session_export.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  function renderScalpingResults() {
    const totalTrades = sessionData.trades.length;
    const totalGainLoss = sessionData.trades.reduce((sum, trade) => sum + trade.value, 0);
    const wins = sessionData.trades.filter(trade => trade.value > 0).length;
    const accuracy = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(2) : 0;
    const maxDrawdown = computeMaxDrawdown();
    const avgOscillation = computeAverageOscillation();
    const summaryHTML = `
      <h3>Session Results</h3>
      <div class="session-summary">
        <p><strong>Total Trades:</strong> ${totalTrades}</p>
        <p><strong>Total Gain/Loss:</strong> $${totalGainLoss.toFixed(2)}</p>
        <p><strong>Accuracy:</strong> ${accuracy}%</p>
        <p><strong>Max Drawdown:</strong> ${maxDrawdown.toFixed(2)}%</p>
        <p><strong>Avg Oscillation:</strong> $${avgOscillation.toFixed(2)}</p>
      </div>
      <button id="backToSessionBtn" class="secondary-btn">Back to Session</button>
    `;
    document.getElementById("scalpingContent").innerHTML = summaryHTML;
    document.getElementById("backToSessionBtn").addEventListener("click", () => {
      document.getElementById("scalpSessionTab").click();
    });
  }

  // --- STRATEGIES (Placeholder) ---
  function renderStrategiesPage() {
    document.getElementById("mainContent").innerHTML = `
      <h2>Strategies</h2>
      <p>Coming soon: detailed strategies and trading plans.</p>
    `;
  }

  // --- CALCULATORS (Risk, Compound, Average Price) ---
  function renderCalculatorsPage() {
    const calculatorsHTML = `
      <h2>Calculators</h2>
      <div class="calc-tabs">
        <span class="calc-tab active" data-target="riskCalc">Risk</span>
        <span class="calc-tab" data-target="compoundCalc">Compound</span>
        <span class="calc-tab" data-target="priceCalc">Average Price</span>
      </div>
      <div class="calc-content">
        <div id="riskCalc" class="calc-item active">
          <div class="calculators-section">
            <h3>Risk Calculator</h3>
            <label for="riskInitialBank">Initial Bank ($):</label>
            <input type="number" id="riskInitialBank" placeholder="Enter your bank" />
            <label for="riskPercentage">Risk Percentage (%):</label>
            <input type="number" id="riskPercentage" placeholder="Enter risk percentage" />
            <button id="calcRiskBtn" class="primary-btn">Calculate Risk</button>
            <p id="riskResult"></p>
          </div>
        </div>
        <div id="compoundCalc" class="calc-item">
          <div class="calculators-section">
            <h3>Compound Interest Calculator</h3>
            <label for="compoundPrincipal">Principal ($):</label>
            <input type="number" id="compoundPrincipal" placeholder="Enter principal" />
            <label for="compoundRate">Interest Rate (%):</label>
            <input type="number" id="compoundRate" placeholder="Enter rate" />
            <label for="compoundBasis">Calculation Basis:</label>
            <select id="compoundBasis">
              <option value="sessions">Sessions</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
            <label for="compoundPeriods">Number of Periods:</label>
            <input type="number" id="compoundPeriods" placeholder="e.g., 10" />
            <button id="calcCompoundBtn" class="primary-btn">Calculate</button>
            <p id="compoundResult"></p>
          </div>
        </div>
        <div id="priceCalc" class="calc-item">
          <div class="calculators-section">
            <h3>Average Price Calculator</h3>
            <label for="currentQuantity">Current Quantity:</label>
            <input type="number" id="currentQuantity" placeholder="e.g., 100" />
            <label for="currentPrice">Current Price ($):</label>
            <input type="number" id="currentPrice" placeholder="e.g., 10.00" step="0.01" />
            <label for="buyQuantity">Quantity to Buy:</label>
            <input type="number" id="buyQuantity" placeholder="e.g., 50" />
            <label for="buyPrice">Buy Price ($):</label>
            <input type="number" id="buyPrice" placeholder="e.g., 12.00" step="0.01" />
            <button id="calcAveragePriceBtn" class="primary-btn">Calculate</button>
            <p id="averagePriceResult"></p>
          </div>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = calculatorsHTML;
    document.querySelectorAll(".calc-tab").forEach(tab => {
      tab.addEventListener("click", function() {
        document.querySelectorAll(".calc-tab").forEach(t => t.classList.remove("active"));
        this.classList.add("active");
        const target = this.getAttribute("data-target");
        document.querySelectorAll(".calc-item").forEach(item => item.classList.remove("active"));
        document.getElementById(target).classList.add("active");
      });
    });
    document.getElementById("calcRiskBtn").addEventListener("click", calcRisk);
    document.getElementById("calcCompoundBtn").addEventListener("click", calcCompound);
    document.getElementById("calcAveragePriceBtn").addEventListener("click", calcAveragePrice);
  }

  // --- FUNÇÕES DAS CALCULADORAS ---
  function calcRisk() {
    const bank = parseFloat(document.getElementById("riskInitialBank").value);
    const riskPct = parseFloat(document.getElementById("riskPercentage").value);
    if (isNaN(bank) || isNaN(riskPct)) {
      alert("Please enter valid values.");
      return;
    }
    const riskValue = (riskPct / 100) * bank;
    document.getElementById("riskResult").textContent = `Risk per trade: $${riskValue.toFixed(2)}`;
  }

  function calcCompound() {
    const principal = parseFloat(document.getElementById("compoundPrincipal").value);
    const rate = parseFloat(document.getElementById("compoundRate").value);
    const basis = document.getElementById("compoundBasis").value;
    const periods = parseInt(document.getElementById("compoundPeriods").value);
    if (isNaN(principal) || isNaN(rate) || isNaN(periods)) {
      alert("Please enter valid values.");
      return;
    }
    let futureValue;
    if (basis === "sessions") {
      futureValue = principal * Math.pow(1 + rate / 100, periods);
    } else if (basis === "monthly") {
      futureValue = principal * Math.pow(1 + (rate / 100) / 12, periods);
    } else if (basis === "yearly") {
      futureValue = principal * Math.pow(1 + rate / 100, periods);
    }
    document.getElementById("compoundResult").textContent = `Future Value: $${futureValue.toFixed(2)}`;
  }

  function calcAveragePrice() {
    const currentQty = parseFloat(document.getElementById("currentQuantity").value);
    const currentPrice = parseFloat(document.getElementById("currentPrice").value);
    const buyQty = parseFloat(document.getElementById("buyQuantity").value);
    const buyPrice = parseFloat(document.getElementById("buyPrice").value);
    if (isNaN(currentQty) || isNaN(currentPrice) || isNaN(buyQty) || isNaN(buyPrice)) {
      alert("Please enter valid values.");
      return;
    }
    const totalQty = currentQty + buyQty;
    const newTotalValue = (currentQty * currentPrice) + (buyQty * buyPrice);
    const averagePrice = newTotalValue / totalQty;
    document.getElementById("averagePriceResult").textContent = `Average Price: $${averagePrice.toFixed(2)}`;
  }
});
