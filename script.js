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
  updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import Chart from 'chart.js/auto';
import 'chartjs-chart-financial';


document.addEventListener("DOMContentLoaded", function() {
  // Variável para o usuário autenticado via Firebase
  let currentUser = null;
  // sessionHistory armazenará as sessões recuperadas do Firestore
  let sessionHistory = [];
  // Variável para cancelar o listener em tempo real, se necessário
  let unsubscribeSessions = null;
  // Variável para a conta de swing trading atualmente selecionada
  let currentAccount = null;

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

  // ----- SESSÃO DE SCALPING (já existente com ajustes) -----
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

  // Mapeamento de ícones para o menu (incluindo novo item "cryptos" e "accounts")
  const iconMap = {
    home: '<i class="fas fa-home menu-icon"></i>',
    cryptos: '<i class="fas fa-coins menu-icon"></i>',
    sessao: '<i class="fas fa-chart-line menu-icon"></i>',
    resultados: '<i class="fas fa-table menu-icon"></i>',
    calculators: '<i class="fas fa-calculator menu-icon"></i>',
    accounts: '<i class="fas fa-wallet menu-icon"></i>',
    perfil: '<i class="fas fa-user menu-icon"></i>',
    login: '<i class="fas fa-sign-in-alt menu-icon"></i>'
  };

  // Atualiza o menu – agora inclui "Accounts" para utilizadores autenticados
  function updateMenu() {
    const menuLinks = document.getElementById("menuLinks");
    menuLinks.innerHTML = "";
    let items = [];
    if (currentUser) {
      items = [
        { hash: "#home", label: "Home", key: "home" },
        { hash: "#cryptos", label: "Cryptos", key: "cryptos" },
        { hash: "#sessao", label: "Scalping", key: "sessao" },
        { hash: "#accounts", label: "Accounts", key: "accounts" },
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
      startSessionsListener();
    } else {
      let section = window.location.hash.substring(1);
      if (["perfil", "sessao", "resultados", "calculators", "cryptos", "accounts"].includes(section)) {
        window.location.hash = "login";
      }
      if (typeof unsubscribeSessions === "function") {
        unsubscribeSessions();
        unsubscribeSessions = null;
      }
    }
  });

  // Roteamento – adicionamos o case "accounts"
  function loadContent() {
    let section = window.location.hash.substring(1);
    if (!section) section = "home";
    if (section.startsWith("article_")) {
      renderArticlePage(section.substring(8));
      return;
    }
    if ((["perfil", "calculators", "sessao", "resultados", "cryptos", "accounts"].includes(section)) && !currentUser) {
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
      case "accounts":
        renderAccountsPage();
        break;
      case "resultados":
        renderResultsPage();
        break;
      case "calculators":
        renderCalculatorsPage();
        break;
      case "cryptos":
        renderCryptosPage();
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

  // --- FUNÇÕES DE AUTENTICAÇÃO (Login, SignUp, Recover) ---
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
        window.location.hash = "home";
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
        window.location.hash = "home";
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
    document.getElementById("articlesGrid").innerHTML = articlesHTML;
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
      <button id="clearHistoryBtn">Limpar Histórico</button>
    `;
    document.getElementById("mainContent").innerHTML = profileHTML;
    document.getElementById("clearHistoryBtn").addEventListener("click", clearHistory);
  }

  // Função para limpar o histórico (deletar todos os documentos de "sessions" deste usuário)
  async function clearHistory() {
    if (!confirm("Tem certeza que deseja limpar todo o histórico de sessões?")) return;
    try {
      const sessionsRef = collection(db, "sessions");
      const q = query(sessionsRef, where("uid", "==", currentUser.uid));
      const querySnapshot = await getDocs(q);
      const promises = [];
      querySnapshot.forEach((docSnap) => {
        promises.push(deleteDoc(doc(db, "sessions", docSnap.id)));
      });
      await Promise.all(promises);
      alert("Histórico limpo com sucesso.");
      sessionHistory = [];
      if (window.location.hash === "#resultados") {
        renderResultsPage();
      }
    } catch (error) {
      console.error("Erro ao limpar histórico: ", error);
      alert("Erro ao limpar histórico: " + error.message);
    }
  }

  // --- SCALPING SESSION (com novas lógicas e gráfico de candlestick) ---
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
    document.getElementById("mainContent").innerHTML = sessionStartHTML;
    document.getElementById("startSessionBtn").addEventListener("click", startSession);
  }

  // Nova lógica da sessão de scalping:
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
      sessionData.riskPerSession = 0.03 * initialBank; // 3%
      sessionData.maxTrades = 6;
      sessionData.objectivePercent = 3;
    } else if (type === "normal") {
      sessionData.riskPerSession = 0.06 * initialBank; // 6%
      sessionData.maxTrades = 4;
      sessionData.objectivePercent = 5;
    } else if (type === "aggressive") {
      sessionData.riskPerSession = 0.12 * initialBank; // 12%
      sessionData.maxTrades = 2;
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

  // Gera dados de candlestick a partir dos trades (agrupa de 2 em 2)
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

  // Inicializa o gráfico de candlestick (requer plugin chartjs-chart-financial)
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
                    <th>Type</th>
                    <th>Value ($)</th>
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
    document.getElementById("mainContent").innerHTML = dashboardHTML;
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
      type: "trade",
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
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${trade.id}</td>
        <td>${trade.type}</td>
        <td>$${trade.value.toFixed(2)}</td>
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

  // Calcula o máximo drawdown da sessão
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

  // Calcula a oscilação média usando os dados de candlestick
  function computeAverageOscillation() {
    const candles = generateCandlestickData();
    if (candles.length === 0) return 0;
    const totalOscillation = candles.reduce((sum, candle) => sum + (candle.h - candle.l), 0);
    return totalOscillation / candles.length;
  }

  // Termina a sessão de scalping e armazena os dados no Firestore
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
        <p><strong>Max Drawdown:</strong> ${sessionSummary.maxDrawdown.toFixed(2)}%</p>
        <p><strong>Avg Oscillation:</strong> $${sessionSummary.avgOscillation.toFixed(2)}</p>
      </div>
      <button id="backSessionBtn" class="secondary-btn">Back</button>
      <button id="exportSessionBtn" class="secondary-btn">Export Results</button>
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
        maxDrawdown: sessionSummary.maxDrawdown,
        avgOscillation: sessionSummary.avgOscillation,
        timestamp: new Date()
      });
      console.log("Dados da sessão armazenados com sucesso.");
    } catch (error) {
      console.error("Erro ao armazenar sessão: ", error);
    }
  }

  // --- NOVA ABA: ACCOUNTS (Dashboard para conta de Swing Trading) ---

  // Renderiza a página de accounts
  async function renderAccountsPage() {
    // Busca contas do utilizador na coleção "accounts" com status "open"
    const accountsRef = collection(db, "accounts");
    const q = query(accountsRef, where("uid", "==", currentUser.uid), where("status", "==", "open"));
    const querySnapshot = await getDocs(q);
    const accounts = [];
    querySnapshot.forEach(docSnap => {
      accounts.push({ id: docSnap.id, ...docSnap.data() });
    });

    if (accounts.length === 0) {
      // Se não houver contas, mostra o card para criar conta
      document.getElementById("mainContent").innerHTML = `
        <div class="account-container">
          <div class="account-card">
            <h2>Você ainda não tem uma conta de Swing Trading</h2>
            <p>Crie sua conta para começar a registrar seus trades e acompanhar sua performance.</p>
            <button id="createAccountBtn" class="primary-btn">Criar Conta</button>
          </div>
        </div>
      `;
      document.getElementById("createAccountBtn").addEventListener("click", renderCreateAccountForm);
    } else if (accounts.length === 1) {
      // Se existir uma conta, vai direto para o dashboard dessa conta
      currentAccount = accounts[0];
      renderAccountDashboard(currentAccount);
    } else {
      // Se houver mais de uma conta, lista todas
      let listHTML = `<div class="account-container"><h2>Suas Contas</h2><div class="accounts-list">`;
      accounts.forEach(acct => {
        listHTML += `
          <div class="account-card clickable" data-id="${acct.id}">
            <h3>${acct.accountName}</h3>
            <p>Saldo Atual: $${acct.currentBalance.toFixed(2)}</p>
          </div>
        `;
      });
      listHTML += `</div></div>`;
      document.getElementById("mainContent").innerHTML = listHTML;
      document.querySelectorAll(".account-card.clickable").forEach(card => {
        card.addEventListener("click", function() {
          const acctId = this.getAttribute("data-id");
          const acct = accounts.find(a => a.id === acctId);
          currentAccount = acct;
          renderAccountDashboard(acct);
        });
      });
    }
  }

  // Renderiza o formulário de criação de conta
  function renderCreateAccountForm() {
    document.getElementById("mainContent").innerHTML = `
      <div class="account-container">
        <div class="account-card">
          <h2>Criar Conta de Swing Trading</h2>
          <form id="createAccountForm" class="account-form">
            <label for="accountName">Nome da Conta:</label>
            <input type="text" id="accountName" placeholder="Ex: Minha Conta" required />
            <label for="initialBalance">Banca Inicial ($):</label>
            <input type="number" id="initialBalance" placeholder="Ex: 5000" min="0" required />
            <button type="button" class="primary-btn" id="submitAccountBtn">Criar Conta</button>
          </form>
          <button type="button" class="secondary-btn" onclick="window.location.hash='#accounts'">Voltar</button>
        </div>
      </div>
    `;
    document.getElementById("submitAccountBtn").addEventListener("click", createAccount);
  }

  // Cria a conta e armazena no Firestore
  async function createAccount() {
    const accountName = document.getElementById("accountName").value.trim();
    const initialBalance = parseFloat(document.getElementById("initialBalance").value);
    if (accountName === "" || isNaN(initialBalance) || initialBalance <= 0) {
      alert("Preencha todos os campos com valores válidos.");
      return;
    }
    try {
      const newAccount = {
        uid: currentUser.uid,
        accountName: accountName,
        initialBalance: initialBalance,
        currentBalance: initialBalance,
        status: "open",
        createdAt: new Date(),
        trades: []  // Array de trades (cada trade terá: id, type, value, date)
      };
      const docRef = await addDoc(collection(db, "accounts"), newAccount);
      newAccount.id = docRef.id;
      currentAccount = newAccount;
      renderAccountDashboard(newAccount);
    } catch (error) {
      alert("Erro ao criar conta: " + error.message);
    }
  }

  // Renderiza o dashboard da conta de swing trading
  function renderAccountDashboard(account) {
    let dashboardHTML = `
      <div class="account-dashboard">
        <div class="account-header">
          <h2>${account.accountName}</h2>
          <p>Saldo Atual: $<span id="accountBalance">${account.currentBalance.toFixed(2)}</span></p>
          <div class="account-actions">
            <button id="depositBtn" class="primary-btn">Depósito</button>
            <button id="withdrawBtn" class="primary-btn">Retirada</button>
            <button id="closeAccountBtn" class="secondary-btn">Fechar Conta</button>
            <button id="exportAccountBtn" class="secondary-btn">Exportar Resultados</button>
          </div>
        </div>
        <div class="account-controls">
          <h3>Registrar Trade de Swing</h3>
          <label for="swingTradeValue">Valor do Trade ($):</label>
          <input type="number" id="swingTradeValue" placeholder="Ex: 100 ou -50" />
          <button id="addSwingTradeBtn" class="primary-btn">Adicionar Trade</button>
        </div>
        <div class="account-filters">
          <label for="filterCount">Filtrar por número de trades:</label>
          <select id="filterCount">
            <option value="all">Todos</option>
            <option value="4">Últimos 4</option>
            <option value="10">Últimos 10</option>
            <option value="20">Últimos 20</option>
            <option value="40">Últimos 40</option>
            <option value="80">Últimos 80</option>
            <option value="160">Últimos 160</option>
          </select>
          <label for="filterDays">Filtrar por dias:</label>
          <select id="filterDays">
            <option value="all">Todos</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
            <option value="360">Últimos 360 dias</option>
          </select>
          <button id="applyFilterBtn" class="secondary-btn">Aplicar Filtro</button>
        </div>
        <div class="account-stats">
          <h3>Estatísticas</h3>
          <div class="stats-cards">
            <div class="stats-card">
              <h4>Total Trades</h4>
              <p id="accTotalTrades">0</p>
            </div>
            <div class="stats-card">
              <h4>Total P/L</h4>
              <p id="accTotalPL">$0.00</p>
            </div>
            <div class="stats-card">
              <h4>Win Rate</h4>
              <p id="accWinRate">0%</p>
            </div>
            <div class="stats-card">
              <h4>Média Trade</h4>
              <p id="accAvgTrade">$0.00</p>
            </div>
            <div class="stats-card">
              <h4>Max Drawdown</h4>
              <p id="accMaxDrawdown">0%</p>
            </div>
          </div>
        </div>
        <div class="account-charts dashboard-row">
          <div class="dashboard-column">
            <h3>Evolução do Saldo</h3>
            <canvas id="accBalanceChart"></canvas>
          </div>
          <div class="dashboard-column">
            <h3>Distribuição dos Trades</h3>
            <canvas id="accTradesChart"></canvas>
          </div>
        </div>
        <div class="account-history">
          <h3>Histórico de Trades</h3>
          <div class="table-responsive">
            <table id="accTradesTable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tipo</th>
                  <th>Valor ($)</th>
                  <th>Data/Hora</th>
                  <th>Remover</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = dashboardHTML;
    // Configura os botões de ação
    document.getElementById("addSwingTradeBtn").addEventListener("click", addSwingTrade);
    document.getElementById("depositBtn").addEventListener("click", depositFunds);
    document.getElementById("withdrawBtn").addEventListener("click", withdrawFunds);
    document.getElementById("closeAccountBtn").addEventListener("click", closeAccount);
    document.getElementById("exportAccountBtn").addEventListener("click", exportAccountData);
    document.getElementById("applyFilterBtn").addEventListener("click", applyAccountFilters);
    updateAccountDashboard();
  }

  // Atualiza a interface do dashboard da conta a partir do currentAccount
  function updateAccountDashboard() {
    // Atualiza saldo
    document.getElementById("accountBalance").textContent = currentAccount.currentBalance.toFixed(2);
    // Atualiza tabela de trades
    renderAccountTradesTable(currentAccount.trades);
    // Atualiza estatísticas
    const totalTrades = currentAccount.trades.length;
    const totalPL = currentAccount.trades.reduce((sum, trade) => sum + trade.value, 0);
    const wins = currentAccount.trades.filter(trade => trade.value > 0).length;
    const winRate = totalTrades ? ((wins / totalTrades) * 100).toFixed(2) : 0;
    const avgTrade = totalTrades ? (totalPL / totalTrades).toFixed(2) : 0;
    const maxDrawdown = computeAccountMaxDrawdown(currentAccount);
    document.getElementById("accTotalTrades").textContent = totalTrades;
    document.getElementById("accTotalPL").textContent = "$" + totalPL.toFixed(2);
    document.getElementById("accWinRate").textContent = winRate + "%";
    document.getElementById("accAvgTrade").textContent = "$" + avgTrade;
    document.getElementById("accMaxDrawdown").textContent = maxDrawdown.toFixed(2) + "%";
    // Atualiza gráficos
    initAccountBalanceChart(currentAccount);
    initAccountTradesChart(currentAccount);
  }

  // Adiciona um trade de swing à conta
  async function addSwingTrade() {
    const value = parseFloat(document.getElementById("swingTradeValue").value);
    if (isNaN(value)) {
      alert("Digite um valor válido para o trade.");
      return;
    }
    const trade = {
      id: currentAccount.trades.length + 1,
      type: "trade",
      value: value,
      date: new Date()
    };
    currentAccount.trades.push(trade);
    // Atualiza o saldo
    currentAccount.currentBalance += value;
    await updateDoc(doc(db, "accounts", currentAccount.id), {
      trades: currentAccount.trades,
      currentBalance: currentAccount.currentBalance
    });
    updateAccountDashboard();
    document.getElementById("swingTradeValue").value = "";
  }

  // Permite fazer um depósito
  async function depositFunds() {
    const amount = parseFloat(prompt("Digite o valor do depósito:"));
    if (isNaN(amount) || amount <= 0) {
      alert("Valor inválido.");
      return;
    }
    const trade = {
      id: currentAccount.trades.length + 1,
      type: "deposit",
      value: amount,
      date: new Date()
    };
    currentAccount.trades.push(trade);
    currentAccount.currentBalance += amount;
    await updateDoc(doc(db, "accounts", currentAccount.id), {
      trades: currentAccount.trades,
      currentBalance: currentAccount.currentBalance
    });
    updateAccountDashboard();
  }

  // Permite fazer uma retirada
  async function withdrawFunds() {
    const amount = parseFloat(prompt("Digite o valor da retirada:"));
    if (isNaN(amount) || amount <= 0) {
      alert("Valor inválido.");
      return;
    }
    if (amount > currentAccount.currentBalance) {
      alert("Saldo insuficiente.");
      return;
    }
    const trade = {
      id: currentAccount.trades.length + 1,
      type: "withdrawal",
      value: -amount,
      date: new Date()
    };
    currentAccount.trades.push(trade);
    currentAccount.currentBalance -= amount;
    await updateDoc(doc(db, "accounts", currentAccount.id), {
      trades: currentAccount.trades,
      currentBalance: currentAccount.currentBalance
    });
    updateAccountDashboard();
  }

  // Remove um trade da conta
  async function removeSwingTrade(index) {
    const removed = currentAccount.trades.splice(index, 1)[0];
    // Recalcula o saldo: reinicia com a banca inicial e soma todos os trades restantes
    currentAccount.currentBalance = currentAccount.initialBalance + currentAccount.trades.reduce((sum, t) => sum + t.value, 0);
    await updateDoc(doc(db, "accounts", currentAccount.id), {
      trades: currentAccount.trades,
      currentBalance: currentAccount.currentBalance
    });
    updateAccountDashboard();
  }

  // Renderiza a tabela de trades da conta
  function renderAccountTradesTable(trades) {
    const tbody = document.querySelector("#accTradesTable tbody");
    tbody.innerHTML = "";
    trades.forEach((trade, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${trade.id}</td>
        <td>${trade.type}</td>
        <td>$${trade.value.toFixed(2)}</td>
        <td>${new Date(trade.date).toLocaleString()}</td>
        <td><button class="remove-btn" data-index="${index}">X</button></td>
      `;
      tbody.appendChild(row);
    });
    document.querySelectorAll("#accTradesTable .remove-btn").forEach(btn => {
      btn.addEventListener("click", function() {
        removeSwingTrade(parseInt(this.getAttribute("data-index")));
      });
    });
  }

  // Calcula o max drawdown da conta
  function computeAccountMaxDrawdown(account) {
    let runningBalance = account.initialBalance;
    let peak = runningBalance;
    let maxDrawdown = 0;
    account.trades.forEach(trade => {
      runningBalance += trade.value;
      if (runningBalance > peak) peak = runningBalance;
      const drawdown = ((peak - runningBalance) / account.initialBalance) * 100;
      if (drawdown > maxDrawdown) maxDrawdown = drawdown;
    });
    return maxDrawdown;
  }

  // Inicializa o gráfico de evolução do saldo da conta
  function initAccountBalanceChart(account) {
    const labels = [];
    let balance = account.initialBalance;
    const data = [balance];
    account.trades.forEach((trade, i) => {
      balance += trade.value;
      labels.push(`Trade ${i+1}`);
      data.push(balance);
    });
    const ctx = document.getElementById("accBalanceChart").getContext("2d");
    // Se já existir um gráfico, destrói-o
    if(window.accBalanceChart) window.accBalanceChart.destroy();
    window.accBalanceChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Start"].concat(labels),
        datasets: [{
          label: "Saldo",
          data: data,
          borderColor: "rgba(0, 216, 255, 1)",
          backgroundColor: "rgba(0, 216, 255, 0.2)",
          fill: true
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: "Trades" } },
          y: { title: { display: true, text: "Saldo ($)" } }
        }
      }
    });
  }

  // Inicializa um gráfico de barras para distribuição dos trades (lucro vs prejuízo)
  function initAccountTradesChart(account) {
    const profitTrades = account.trades.filter(t => t.value > 0).length;
    const lossTrades = account.trades.filter(t => t.value <= 0).length;
    const ctx = document.getElementById("accTradesChart").getContext("2d");
    if(window.accTradesChart) window.accTradesChart.destroy();
    window.accTradesChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: ["Trades Lucrativos", "Trades Prejuízo"],
        datasets: [{
          label: "Quantidade",
          data: [profitTrades, lossTrades],
          backgroundColor: [
            "rgba(0, 216, 255, 0.7)",
            "rgba(255, 0, 0, 0.7)"
          ]
        }]
      },
      options: {
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  }

  // Aplica filtros ao histórico de trades na conta
  function applyAccountFilters() {
    const countFilter = document.getElementById("filterCount").value;
    const daysFilter = document.getElementById("filterDays").value;
    let filtered = currentAccount.trades;
    if (daysFilter !== "all") {
      const days = parseInt(daysFilter);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      filtered = filtered.filter(t => new Date(t.date) >= cutoff);
    }
    if (countFilter !== "all") {
      const count = parseInt(countFilter);
      filtered = filtered.slice(-count);
    }
    renderAccountTradesTable(filtered);
  }

  // Exporta os resultados da conta (gera um bloco de texto para copiar)
  function exportAccountData() {
    let exportText = `Conta: ${currentAccount.accountName}\n`;
    exportText += `Banca Inicial: $${currentAccount.initialBalance.toFixed(2)}\n`;
    exportText += `Saldo Atual: $${currentAccount.currentBalance.toFixed(2)}\n\n`;
    exportText += `Histórico de Trades:\n`;
    currentAccount.trades.forEach(trade => {
      exportText += `${trade.id} - ${trade.type} - $${trade.value.toFixed(2)} - ${new Date(trade.date).toLocaleString()}\n`;
    });
    // Cria um blob e força o download de um arquivo de texto
    const blob = new Blob([exportText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = currentAccount.accountName + "_export.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Fecha a conta (marca como closed)
  async function closeAccount() {
    if (!confirm("Tem certeza que deseja fechar esta conta?")) return;
    try {
      await updateDoc(doc(db, "accounts", currentAccount.id), {
        status: "closed"
      });
      alert("Conta fechada com sucesso.");
      window.location.hash = "accounts";
    } catch (error) {
      alert("Erro ao fechar conta: " + error.message);
    }
  }

  // --- CALCULATORS SECTION (já existente) ---
  function renderCalculatorsPage() {
    const calculatorsHTML = `
      <h2>Calculators</h2>
      <div class="calc-tabs">
        <span class="calc-tab active" data-target="riskCalc">Risk</span>
        <span class="calc-tab" data-target="compoundCalc">Compound</span>
        <span class="calc-tab" data-target="predictionCalc">Prediction</span>
        <span class="calc-tab" data-target="stopLossCalc">Stop Loss</span>
        <span class="calc-tab" data-target="priceCalc">Preço Médio</span>
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
        <div id="priceCalc" class="calc-item">
          <div class="calculators-section">
            <h3>Calculadora de Preço Médio</h3>
            <label for="currentQuantity">Quantidade Atual:</label>
            <input type="number" id="currentQuantity" placeholder="Ex: 100" />
            <label for="currentPrice">Preço Atual:</label>
            <input type="number" id="currentPrice" placeholder="Ex: 10.00" step="0.01" />
            <label for="buyQuantity">Quantidade a Comprar:</label>
            <input type="number" id="buyQuantity" placeholder="Ex: 50" />
            <label for="buyPrice">Preço de Compra:</label>
            <input type="number" id="buyPrice" placeholder="Ex: 12.00" step="0.01" />
            <button id="calcAveragePriceBtn">Calcular Preço Médio</button>
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
    document.getElementById("calcPredictionBtn").addEventListener("click", calcPrediction);
    document.getElementById("calcStopLossBtn").addEventListener("click", calcStopLoss);
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

  function calcAveragePrice() {
    const currentQty = parseFloat(document.getElementById("currentQuantity").value);
    const currentPrice = parseFloat(document.getElementById("currentPrice").value);
    const buyQty = parseFloat(document.getElementById("buyQuantity").value);
    const buyPrice = parseFloat(document.getElementById("buyPrice").value);
    if (isNaN(currentQty) || isNaN(currentPrice) || isNaN(buyQty) || isNaN(buyPrice)) {
      alert("Por favor, preencha todos os campos com valores válidos.");
      return;
    }
    const totalQty = currentQty + buyQty;
    const newTotalValue = (currentQty * currentPrice) + (buyQty * buyPrice);
    const averagePrice = newTotalValue / totalQty;
    document.getElementById("averagePriceResult").textContent = `Preço Médio: $${averagePrice.toFixed(2)}`;
  }

  // --- LISTENER EM TEMPO REAL PARA AS SESSÕES ---
  function startSessionsListener() {
    if (!currentUser) return;
    const sessionsRef = collection(db, "sessions");
    const q = query(sessionsRef, where("uid", "==", currentUser.uid));
    if (typeof unsubscribeSessions === "function") {
      unsubscribeSessions();
    }
    unsubscribeSessions = onSnapshot(q, (snapshot) => {
      const sessions = [];
      snapshot.forEach(doc => {
        sessions.push({ id: doc.id, ...doc.data() });
      });
      sessionHistory = sessions;
      console.log("Sessões em tempo real:", sessionHistory);
      if (window.location.hash === "#resultados") {
        renderResultsPage();
      }
    }, (error) => {
      console.error("Erro no onSnapshot:", error);
    });
  }

  // --- RESULTADOS: RENDERIZAÇÃO DOS DADOS COM FILTRO (já existente) ---
  async function renderResultsPage() {
    let filterValue = "all";
    if (document.getElementById("filterSelect")) {
      filterValue = document.getElementById("filterSelect").value;
    }
    
    const sortedSessions = sessionHistory.sort((a, b) => {
      if (a.timestamp && b.timestamp) {
        return b.timestamp.toMillis() - a.timestamp.toMillis();
      } else {
        return new Date(b.endTime) - new Date(a.endTime);
      }
    });
    
    const filteredSessions = applyFilter(sortedSessions, filterValue);
    
    const totalSessions = filteredSessions.length;
    const totalTrades = filteredSessions.reduce((acc, s) => acc + s.totalTrades, 0);
    const totalGainLoss = filteredSessions.reduce((acc, s) => acc + s.totalGainLoss, 0);
    const avgProfitPercent = (filteredSessions.reduce((acc, s) => acc + ((s.totalGainLoss / s.initialBank) * 100), 0) / totalSessions || 0).toFixed(2);
    const avgDrawdown = (filteredSessions.reduce((acc, s) => acc + parseFloat(s.maxDrawdown || 0), 0) / totalSessions || 0).toFixed(2);
    const avgOscillation = (filteredSessions.reduce((acc, s) => acc + parseFloat(s.avgOscillation || 0), 0) / totalSessions || 0).toFixed(2);

    const headerHTML = `
      <div class="results-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Session Results</h2>
        <div class="results-filter">
          <select id="filterSelect">
            <option value="all" ${filterValue==="all" ? "selected" : ""}>Todas as sessões</option>
            <option value="month" ${filterValue==="month" ? "selected" : ""}>Início do mês até agora</option>
            <option value="year" ${filterValue==="year" ? "selected" : ""}>Início do ano até agora</option>
            <option value="week" ${filterValue==="week" ? "selected" : ""}>Início da semana até agora</option>
            <option value="last10" ${filterValue==="last10" ? "selected" : ""}>Últimas 10 sessões</option>
            <option value="last25" ${filterValue==="last25" ? "selected" : ""}>Últimas 25 sessões</option>
            <option value="last50" ${filterValue==="last50" ? "selected" : ""}>Últimas 50 sessões</option>
            <option value="last100" ${filterValue==="last100" ? "selected" : ""}>Últimas 100 sessões</option>
            <option value="last3months" ${filterValue==="last3months" ? "selected" : ""}>Últimos 3 meses</option>
          </select>
        </div>
      </div>
    `;
    
    const statsCardsHTML = `
      <div class="stats-cards">
        <div class="stats-card">
          <h3>Total Sessions</h3>
          <p>${totalSessions}</p>
        </div>
        <div class="stats-card">
          <h3>Total Trades</h3>
          <p>${totalTrades}</p>
        </div>
        <div class="stats-card">
          <h3>Total Gain/Loss</h3>
          <p>$${totalGainLoss.toFixed(2)}</p>
        </div>
        <div class="stats-card">
          <h3>Average Profit (%)</h3>
          <p>${avgProfitPercent}%</p>
        </div>
        <div class="stats-card">
          <h3>Max Drawdown (%)</h3>
          <p>${avgDrawdown}%</p>
        </div>
        <div class="stats-card">
          <h3>Avg Oscillation</h3>
          <p>$${avgOscillation}</p>
        </div>
      </div>
    `;
    
    const chartsHTML = `
      <div class="dashboard-row">
        <div class="dashboard-column">
          <h3>Profit/Loss Chart</h3>
          <canvas id="resultsBarChart"></canvas>
        </div>
        <div class="dashboard-column">
          <h3>Drawdown Chart</h3>
          <canvas id="drawdownChart"></canvas>
        </div>
        <div class="dashboard-column">
          <h3>Profit Distribution</h3>
          <canvas id="resultsPieChart"></canvas>
        </div>
      </div>
    `;
    
    const tableHTML = `
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
                  <th>Max Drawdown</th>
                </tr>
              </thead>
              <tbody></tbody>
            </table>
          </div>
        </div>
      </div>
    `;
    
    const resultsHTML = headerHTML + statsCardsHTML + chartsHTML + tableHTML;
    
    document.getElementById("mainContent").innerHTML = resultsHTML;
    document.getElementById("filterSelect").addEventListener("change", () => {
      renderResultsPage();
    });
    renderResultsTable(filteredSessions);
    initResultsBarChart(filteredSessions);
    initResultsPieChart(filteredSessions);
    initDrawdownChart(filteredSessions);
  }
  
  function applyFilter(sessions, filterValue) {
    const now = new Date();
    let filtered = sessions;
    switch(filterValue) {
      case "month":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = sessions.filter(s => new Date(s.endTime) >= startOfMonth);
        break;
      case "year":
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        filtered = sessions.filter(s => new Date(s.endTime) >= startOfYear);
        break;
      case "week":
        const day = now.getDay();
        const diff = now.getDate() - (day === 0 ? 6 : day - 1);
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), diff);
        filtered = sessions.filter(s => new Date(s.endTime) >= startOfWeek);
        break;
      case "last10":
        filtered = sessions.sort((a, b) => new Date(b.endTime) - new Date(a.endTime)).slice(0, 10);
        break;
      case "last25":
        filtered = sessions.sort((a, b) => new Date(b.endTime) - new Date(a.endTime)).slice(0, 25);
        break;
      case "last50":
        filtered = sessions.sort((a, b) => new Date(b.endTime) - new Date(a.endTime)).slice(0, 50);
        break;
      case "last100":
        filtered = sessions.sort((a, b) => new Date(b.endTime) - new Date(a.endTime)).slice(0, 100);
        break;
      case "last3months":
        const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        filtered = sessions.filter(s => new Date(s.endTime) >= threeMonthsAgo);
        break;
      case "all":
      default:
        filtered = sessions;
        break;
    }
    return filtered;
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
        <td>${s.maxDrawdown ? s.maxDrawdown.toFixed(2) + "%" : "-"}</td>
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

  function initDrawdownChart(sessions) {
    const labels = sessions.map((s, i) => `Session ${i + 1}`);
    const drawdownValues = sessions.map(s => s.maxDrawdown);
    const ctx = document.getElementById("drawdownChart").getContext("2d");
    new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Max Drawdown (%)",
          data: drawdownValues,
          backgroundColor: "rgba(255, 0, 0, 0.5)",
          borderColor: "rgba(255, 0, 0, 1)",
          borderWidth: 1
        }]
      },
      options: {
        scales: {
          x: { title: { display: true, text: "Sessions" } },
          y: { title: { display: true, text: "Drawdown (%)" }, beginAtZero: true }
        }
      }
    });
  }

  // --- NOVA PÁGINA: CRYPTOS ---
  function renderCryptosPage() {
    document.getElementById("mainContent").innerHTML = `
      <div class="cryptos-header" style="display: flex; justify-content: space-between; align-items: center;">
        <h2>Top 0 Criptomoedas por Market Cap</h2>
      </div>
      <div id="cryptosContent" style="margin-top: 20px;">Carregando dados...</div>
    `;
    fetchCryptosData();
  }

  function fetchCryptosData() {
    fetch("/api/coinmarketcap?limit=50")
      .then(response => response.json())
      .then(data => {
        if (!data || !data.data) {
          document.getElementById("cryptosContent").innerHTML = `<p>Erro ao receber dados da API.</p>`;
          return;
        }
        renderCryptosTable(data.data);
      })
      .catch(err => {
        document.getElementById("cryptosContent").innerHTML = `<p>Erro ao carregar dados: ${err.message}</p>`;
      });
  }

  function renderCryptosTable(cryptos) {
    const filteredCryptos = cryptos.filter(coin => {
      return !coin.tags || (coin.tags && !coin.tags.includes("stablecoin"));
    });
    let tableHTML = `
      <table class="cryptos-table">
        <thead>
          <tr>
            <th>Nome</th>
            <th>Preço</th>
            <th>24h %</th>
            <th>7d %</th>
            <th>30d %</th>
          </tr>
        </thead>
        <tbody>
    `;
    filteredCryptos.forEach(crypto => {
      tableHTML += `
        <tr>
          <td>${crypto.name}</td>
          <td>$${crypto.quote.USD.price.toFixed(2)}</td>
          <td>${crypto.quote.USD.percent_change_24h.toFixed(2)}%</td>
          <td>${crypto.quote.USD.percent_change_7d.toFixed(2)}%</td>
          <td>${crypto.quote.USD.percent_change_30d.toFixed(2)}%</td>
        </tr>
      `;
    });
    tableHTML += `
        </tbody>
      </table>
    `;
    document.getElementById("cryptosContent").innerHTML = tableHTML;
  }

  function formatNumber(num) {
    return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }
});
