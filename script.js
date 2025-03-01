// script.js
import { 
  auth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  db 
} from './firebase-config.js';
import { collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

document.addEventListener("DOMContentLoaded", function() {
  // Variável para o usuário autenticado via Firebase
  let currentUser = null;
  // sessionHistory vai armazenar as sessões recuperadas do Firestore
  let sessionHistory = [];

  // Dummy articles para a Home
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
    riskPerTrade: 0,
    maxTrades: 0,
    objectivePercent: 0
  };

  // Variáveis para gráficos
  let performanceChart;
  let resultsChart;

  // Mapeamento de ícones para o menu
  const iconMap = {
    home: '<i class="fas fa-home menu-icon"></i>',
    sessao: '<i class="fas fa-chart-line menu-icon"></i>',
    resultados: '<i class="fas fa-table menu-icon"></i>',
    calculators: '<i class="fas fa-calculator menu-icon"></i>',
    perfil: '<i class="fas fa-user menu-icon"></i>',
    login: '<i class="fas fa-sign-in-alt menu-icon"></i>'
  };

  // Atualiza o menu
  function updateMenu() {
    const menuLinks = document.getElementById("menuLinks");
    menuLinks.innerHTML = "";
    let items = [];
    if (currentUser) {
      items = [
        { hash: "#home", label: "Home", key: "home" },
        { hash: "#sessao", label: "Scalping", key: "sessao" },
        { hash: "#resultados", label: "Results", key: "resultados" },
        { hash: "#calculators", label: "Calculators", key: "calculators" },
        { hash: "#perfil", label: "Profile", key: "perfil" }
      ];
    } else {
      items = [
        { hash: "#home", label: "Home", key: "home" },
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

  // Monitorar o estado de autenticação do Firebase
  auth.onAuthStateChanged((user) => {
    currentUser = user;
    updateMenu();
    if (currentUser) {
      // Recupera as sessões armazenadas para o utilizador atual
      fetchUserSessions();
    } else {
      let section = window.location.hash.substring(1);
      if (["perfil", "sessao", "resultados", "calculators"].includes(section)) {
        window.location.hash = "login";
      }
    }
  });

  // Carrega o conteúdo com base no hash da URL
  function loadContent() {
    let section = window.location.hash.substring(1);
    if (!section) section = "home";
    if (section.startsWith("article_")) {
      renderArticlePage(section.substring(8));
      return;
    }
    if ((["perfil", "calculators", "sessao", "resultados"].includes(section)) && !currentUser) {
      window.location.hash = "login";
      return;
    }
    switch (section) {
      case "home":
        renderHome();
        break;
      case "login":
        renderLogin();
        break;
      case "signup":
        renderSignUp();
        break;
      case "recover":
        renderRecover();
        break;
      case "perfil":
        renderProfile();
        break;
      case "sessao":
        renderSessionStart();
        break;
      case "resultados":
        // Aguarda a recuperação dos dados antes de renderizar os resultados
        renderResultsPage();
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

  // --- AUTENTICAÇÃO: LOGIN, SIGNUP, RECUPERAÇÃO, LOGOUT ---

  function renderLogin() {
    const loginHTML = `
      <h2>Login</h2>
      <div class="login-form">
        <label for="email">Email:</label>
        <input type="email" id="email" placeholder="Enter your email" />
        <label for="password">Password:</label>
        <input type="password" id="password" placeholder="Enter your password" />
        <button id="loginBtn">Login</button>
      </div>
      <p>
        <a href="#signup">Criar Conta</a> | 
        <a href="#recover">Recuperar Senha</a>
      </p>
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
        window.location.hash = "home";
      })
      .catch((error) => {
        alert("Erro ao fazer login: " + error.message);
      });
  }

  function renderSignUp() {
    const signUpHTML = `
      <h2>Criar Conta</h2>
      <div class="session-form">
        <label for="email">Email:</label>
        <input type="email" id="email" placeholder="Enter your email" />
        <label for="password">Password:</label>
        <input type="password" id="password" placeholder="Enter your password" />
        <button id="signupBtn">Criar Conta</button>
      </div>
      <p>
        <a href="#login">Já tem conta? Login</a>
      </p>
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
        window.location.hash = "home";
      })
      .catch((error) => {
        alert("Erro ao criar conta: " + error.message);
      });
  }

  function renderRecover() {
    const recoverHTML = `
      <h2>Recuperar Senha</h2>
      <div class="session-form">
        <label for="email">Email:</label>
        <input type="email" id="email" placeholder="Enter your email" />
        <button id="recoverBtn">Enviar Recuperação</button>
      </div>
      <p>
        <a href="#login">Voltar para Login</a>
      </p>
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

  // --- HOME SECTION ---
  function renderHome() {
    const tabsHTML = `
      <div class="article-tabs">
        <span class="article-tab active" data-category="all">All</span>
        <span class="article-tab" data-category="noticia">News</span>
        <span class="article-tab" data-category="análises">Analytics</span>
        <span class="article-tab" data-category="informação">Info</span>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = tabsHTML + `<div id="articlesGrid"></div>`;
    renderArticles("all");
    document.querySelectorAll(".article-tab").forEach(tab => {
      tab.style.cursor = "pointer";
      tab.addEventListener("click", function() {
        document.querySelectorAll(".article-tab").forEach(t => t.classList.remove("active"));
        this.classList.add("active");
        renderArticles(this.getAttribute("data-category"));
      });
    });
  }

  function renderArticles(category) {
    const grid = document.getElementById("articlesGrid");
    let articlesHTML = `<div class="articles-grid">`;
    dummyArticles.forEach(article => {
      if (category === "all" || article.category === category) {
        articlesHTML += `
          <div class="article-card" data-category="${article.category}">
            <img src="${article.thumbnail}" alt="Thumbnail" class="article-thumb" />
            <h3>${article.title}</h3>
            <p><em>By ${article.author} - ${article.date}</em></p>
            <p>${article.excerpt}</p>
            <a href="#article_${article.id}" class="read-more">Read More</a>
          </div>
        `;
      }
    });
    articlesHTML += `</div>`;
    grid.innerHTML = articlesHTML;
  }

  // --- ARTICLE PAGE ---
  function renderArticlePage(articleId) {
    const id = parseInt(articleId);
    const article = dummyArticles.find(a => a.id === id);
    if (!article) {
      document.getElementById("mainContent").innerHTML = "<h2>Article not found</h2>";
      return;
    }
    const articleHTML = `
      <div class="article-page">
        <button class="back-btn" onclick="window.history.back()">← Back</button>
        <h2>${article.title}</h2>
        <p><em>By ${article.author} - ${article.date}</em></p>
        <img src="${article.thumbnail}" alt="Article Image" class="article-main-img" />
        <div class="article-content">
          <p>${article.content}</p>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = articleHTML;
  }
  
  // --- PROFILE SECTION ---
  function renderProfile() {
    const profileHTML = `
      <h2>My Profile</h2>
      <p><strong>Email:</strong> ${currentUser.email}</p>
      <p>Manage your information, view your posts, and track your activity.</p>
    `;
    document.getElementById("mainContent").innerHTML = profileHTML;
  }

  // --- SCALPING SESSION ---
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
          <button id="startSessionBtn">Start Session</button>
        </div>
        <div class="session-info">
          <h3>Session Guidelines</h3>
          <p>The objective is to capture small gains with controlled risk.</p>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = sessionStartHTML;
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
      sessionData.riskPerTrade = 0.01 * initialBank;
      sessionData.maxTrades = 15;
      sessionData.objectivePercent = 3;
    } else if (type === "normal") {
      sessionData.riskPerTrade = 0.02 * initialBank;
      sessionData.maxTrades = 10;
      sessionData.objectivePercent = 5;
    } else if (type === "aggressive") {
      sessionData.riskPerTrade = 0.03 * initialBank;
      sessionData.maxTrades = 5;
      sessionData.objectivePercent = 10;
    }
    sessionStartTime = new Date();
    sessionTimerInterval = setInterval(updateTimer, 1000);
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

  function renderSessionDashboard() {
    const worstBalance = sessionData.initialBank - (sessionData.riskPerTrade * sessionData.maxTrades);
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
            <p><strong>Risk per Trade:</strong> $${sessionData.riskPerTrade.toFixed(2)}</p>
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
            <button id="addTradeBtn">Add Trade</button>
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
            <button id="endSessionBtn" style="background-color: var(--error-color);">
              End Session
            </button>
          </div>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = dashboardHTML;
    document.getElementById("addTradeBtn").addEventListener("click", addTrade);
    document.getElementById("endSessionBtn").addEventListener("click", terminateSession);
    initChart();
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

  function initChart() {
    const ctx = document.getElementById("performanceChart").getContext("2d");
    performanceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: sessionData.trades.map((_, i) => i + 1),
        datasets: [{
          label: "Performance",
          data: sessionData.trades.map(trade => trade.value),
          borderColor: "rgba(0, 216, 255, 1)",
          backgroundColor: "rgba(0, 216, 255, 0.2)",
          fill: false
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: "Trade No." } },
          y: { title: { display: true, text: "Value ($)" } }
        }
      }
    });
  }

  function updateChart() {
    if (performanceChart) {
      performanceChart.data.labels = sessionData.trades.map((_, i) => i + 1);
      performanceChart.data.datasets[0].data = sessionData.trades.map(trade => trade.value);
      performanceChart.update();
    }
  }

  // --- TERMINAR SESSÃO E ARMAZENAR NO FIRESTORE ---
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
    const sessionSummary = {
      startTime: sessionStartTime,
      endTime: endTime,
      duration: totalDuration,
      initialBank: sessionData.initialBank,
      totalTrades: totalTrades,
      totalGainLoss: totalGainLoss,
      accuracy: accuracy,
      type: sessionData.type
    };
    // Adiciona a sessão atual ao histórico em memória
    sessionHistory.push(sessionSummary);
    // Armazena no Firestore
    await storeSessionData(sessionSummary);
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
      </div>
      <button id="backSessionBtn">Back</button>
      <button id="exportSessionBtn">Export Results</button>
    `;
    document.getElementById("mainContent").innerHTML = summaryHTML;
    document.getElementById("backSessionBtn").addEventListener("click", () => {
      window.location.hash = "home";
    });
    document.getElementById("exportSessionBtn").addEventListener("click", exportSessionResults);
  }

  async function storeSessionData(sessionSummary) {
    try {
      await addDoc(collection(db, "sessions"), {
        uid: currentUser.uid,
        startTime: sessionSummary.startTime,
        endTime: sessionSummary.endTime,
        duration: sessionSummary.duration,
        initialBank: sessionSummary.initialBank,
        totalTrades: sessionSummary.totalTrades,
        totalGainLoss: sessionSummary.totalGainLoss,
        accuracy: sessionSummary.accuracy,
        type: sessionSummary.type,
        timestamp: new Date()
      });
      console.log("Dados da sessão armazenados com sucesso.");
    } catch (error) {
      console.error("Erro ao armazenar sessão: ", error);
    }
  }

  // --- RECUPERAR SESSÕES DO FIRESTORE ---
  async function fetchUserSessions() {
    if (!currentUser) return;
    try {
      const sessionsRef = collection(db, "sessions");
      const q = query(sessionsRef, where("uid", "==", currentUser.uid));
      const querySnapshot = await getDocs(q);
      const sessions = [];
      querySnapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() });
      });
      // Atualiza o sessionHistory com as sessões recuperadas
      sessionHistory = sessions;
      console.log("Sessões carregadas:", sessions);
    } catch (error) {
      console.error("Erro ao recuperar sessões: ", error);
    }
  }

  // --- RESULTADOS: RENDERIZAÇÃO DOS DADOS ---
  async function renderResultsPage() {
    // Antes de renderizar, busca as sessões atualizadas do Firestore
    await fetchUserSessions();
    // Ordena as sessões por timestamp (mais recentes primeiro)
    const sessions = sessionHistory.sort((a, b) => b.timestamp - a.timestamp);
    const aggHTML = `
      <div class="aggregate-stats">
        <h3>Overall Performance</h3>
        <p><strong>Total Sessions:</strong> ${sessions.length}</p>
        <p><strong>Total Trades:</strong> ${sessions.reduce((acc, s) => acc + s.totalTrades, 0)}</p>
        <p><strong>Total Gain/Loss:</strong> $${sessions.reduce((acc, s) => acc + s.totalGainLoss, 0).toFixed(2)}</p>
        <p><strong>Average Profit (%):</strong> ${ (sessions.reduce((acc, s) => acc + ((s.totalGainLoss / s.initialBank) * 100), 0) / sessions.length || 0).toFixed(2) }%</p>
        <p><strong>Average Session Duration:</strong> --</p>
        <p><strong>Best Session:</strong> $${ Math.max(...sessions.map(s => s.totalGainLoss)).toFixed(2) }</p>
        <p><strong>Worst Session:</strong> $${ Math.min(...sessions.map(s => s.totalGainLoss)).toFixed(2) }</p>
        <p><strong>Average Accuracy:</strong> ${ (sessions.reduce((acc, s) => acc + parseFloat(s.accuracy), 0) / sessions.length || 0).toFixed(2) }%</p>
      </div>
    `;
    const resultsHTML = `
      <h2>Session Results</h2>
      ${aggHTML}
      <div class="dashboard-row">
        <div class="dashboard-column">
          <h3>Profit/Loss Chart</h3>
          <canvas id="resultsBarChart"></canvas>
        </div>
        <div class="dashboard-column">
          <h3>Profit Distribution</h3>
          <canvas id="resultsPieChart"></canvas>
        </div>
      </div>
      <div class="dashboard-row">
        <div class="dashboard-column full-width">
          <h3>Detailed Session Table</h3>
          <div class="table-responsive">
            <table id="resultsTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Start</th>
                  <th>End</th>
                  <th>Duration</th>
                  <th>Initial Bank</th>
                  <th>Total Trades</th>
                  <th>Total Gain/Loss</th>
                  <th>Accuracy</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = resultsHTML;
    renderResultsTable(sessions);
    initResultsBarChart(sessions);
    initResultsPieChart(sessions);
  }
  
  function renderResultsTable(sessions) {
    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";
    sessions.forEach((s, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${index + 1}</td>
        <td>${new Date(s.startTime).toLocaleString()}</td>
        <td>${new Date(s.endTime).toLocaleString()}</td>
        <td>${s.duration}</td>
        <td>$${s.initialBank.toFixed(2)}</td>
        <td>${s.totalTrades}</td>
        <td>$${s.totalGainLoss.toFixed(2)}</td>
        <td>${s.accuracy}%</td>
      `;
      tbody.appendChild(row);
    });
  }
  
  function initResultsBarChart(sessions) {
    const ctx = document.getElementById("resultsBarChart").getContext("2d");
    resultsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: sessions.map((s, i) => `Session ${i + 1}`),
        datasets: [{
          label: "Total Gain/Loss ($)",
          data: sessions.map(s => s.totalGainLoss),
          backgroundColor: "rgba(0, 216, 255, 0.5)",
          borderColor: "rgba(0, 216, 255, 1)",
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: "Sessions" } },
          y: { title: { display: true, text: "Gain/Loss ($)" }, beginAtZero: true }
        }
      }
    });
  }
  
  function initResultsPieChart(sessions) {
    const profitCount = sessions.filter(s => s.totalGainLoss > 0).length;
    const lossCount = sessions.filter(s => s.totalGainLoss <= 0).length;
    const ctx = document.getElementById("resultsPieChart").getContext("2d");
    new Chart(ctx, {
      type: "pie",
      data: {
        labels: ["Profitable Sessions", "Losing Sessions"],
        datasets: [{
          data: [profitCount, lossCount],
          backgroundColor: [
            "rgba(0, 216, 255, 0.7)",
            "rgba(255, 0, 0, 0.7)"
          ]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });
  }

  // --- CALCULATORS SECTION (mantido igual) ---
  function renderCalculatorsPage() {
    const calculatorsHTML = `
      <h2>Calculators</h2>
      <div class="calc-tabs">
        <span class="calc-tab active" data-target="riskCalc">Risk</span>
        <span class="calc-tab" data-target="compoundCalc">Compound</span>
        <span class="calc-tab" data-target="predictionCalc">Prediction</span>
        <span class="calc-tab" data-target="stopLossCalc">Stop Loss</span>
      </div>
      <div class="calc-content">
        <div id="riskCalc" class="calc-item active">
          <div class="calculators-section">
            <h3>Risk Calculator</h3>
            <label for="riskInitialBank">Initial Bank ($):</label>
            <input type="number" id="riskInitialBank" placeholder="Enter your bank" />
            <label for="riskPercentage">Risk Percentage (%):</label>
            <input type="number" id="riskPercentage" placeholder="Enter risk percentage" />
            <button id="calcRiskBtn">Calculate Risk</button>
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
            <button id="calcCompoundBtn">Calculate</button>
            <p id="compoundResult"></p>
          </div>
        </div>
        <div id="predictionCalc" class="calc-item">
          <div class="calculators-section">
            <h3>Session Prediction Calculator</h3>
            <label for="predInitialBank">Initial Bank ($):</label>
            <input type="number" id="predInitialBank" placeholder="Enter your bank" />
            <label for="predTradeCount">Number of Trades:</label>
            <input type="number" id="predTradeCount" placeholder="Enter number of trades" />
            <label for="predAvgProfit">Average Profit/Loss per Trade ($):</label>
            <input type="number" id="predAvgProfit" placeholder="Enter average profit/loss" />
            <button id="calcPredictionBtn">Predict Final Bank</button>
            <p id="predictionResult"></p>
          </div>
        </div>
        <div id="stopLossCalc" class="calc-item">
          <div class="calculators-section">
            <h3>Stop Loss Calculator</h3>
            <label for="stopInitialBank">Initial Bank ($):</label>
            <input type="number" id="stopInitialBank" placeholder="Enter your bank" />
            <label for="stopRiskPercentage">Risk Percentage per Trade (%):</label>
            <input type="number" id="stopRiskPercentage" placeholder="Enter risk percentage" />
            <label for="entryPrice">Entry Price ($):</label>
            <input type="number" id="entryPrice" placeholder="Enter entry price" />
            <button id="calcStopLossBtn">Calculate Stop Loss</button>
            <p id="stopLossResult"></p>
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
    document.getElementById("calcPredictionBtn").addEventListener("click", calcPrediction);
    document.getElementById("calcStopLossBtn").addEventListener("click", calcStopLoss);
  }
  
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
  
  function calcPrediction() {
    const bank = parseFloat(document.getElementById("predInitialBank").value);
    const tradeCount = parseInt(document.getElementById("predTradeCount").value);
    const avgProfit = parseFloat(document.getElementById("predAvgProfit").value);
    if (isNaN(bank) || isNaN(tradeCount) || isNaN(avgProfit)) {
      alert("Please enter valid values.");
      return;
    }
    const finalBank = bank + (tradeCount * avgProfit);
    document.getElementById("predictionResult").textContent = `Predicted Final Bank: $${finalBank.toFixed(2)}`;
  }
  
  function calcStopLoss() {
    const bank = parseFloat(document.getElementById("stopInitialBank").value);
    const riskPct = parseFloat(document.getElementById("stopRiskPercentage").value);
    const entryPrice = parseFloat(document.getElementById("entryPrice").value);
    if (isNaN(bank) || isNaN(riskPct) || isNaN(entryPrice)) {
      alert("Please enter valid values.");
      return;
    }
    const riskAmount = (riskPct / 100) * bank;
    const stopLossPrice = entryPrice - riskAmount;
    document.getElementById("stopLossResult").textContent = `Suggested Stop Loss Price: $${stopLossPrice.toFixed(2)}`;
  }
});
