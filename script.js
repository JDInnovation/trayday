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
  // Variáveis para o usuário autenticado via Firebase
  let currentUser = null;
  // sessionHistory armazenará as sessões recuperadas do Firestore
  let sessionHistory = [];
  // Variável para cancelar o listener em tempo real, se necessário
  let unsubscribeSessions = null;

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
    riskPerSession: 0,
    maxTrades: 0,
    objectivePercent: 0
  };

  // Variáveis para gráficos
  let performanceChart;
  let resultsChart;

  // Mapeamento de ícones para o menu (incluindo as novas abas)
  const iconMap = {
    home: '<i class="fas fa-home menu-icon"></i>',
    cryptos: '<i class="fas fa-coins menu-icon"></i>',
    sessao: '<i class="fas fa-chart-line menu-icon"></i>',
    resultados: '<i class="fas fa-table menu-icon"></i>',
    calculators: '<i class="fas fa-calculator menu-icon"></i>',
    perfil: '<i class="fas fa-user menu-icon"></i>',
    accounts: '<i class="fas fa-wallet menu-icon"></i>',
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
        { hash: "#cryptos", label: "Cryptos", key: "cryptos" },
        { hash: "#sessao", label: "Scalping", key: "sessao" },
        { hash: "#resultados", label: "Results", key: "resultados" },
        { hash: "#calculators", label: "Calculators", key: "calculators" },
        { hash: "#accounts", label: "Accounts", key: "accounts" },
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
      if (["perfil", "calculators", "sessao", "resultados", "cryptos", "accounts"].includes(section)) {
        window.location.hash = "login";
      }
      if (typeof unsubscribeSessions === "function") {
        unsubscribeSessions();
        unsubscribeSessions = null;
      }
    }
  });

  // Roteamento
  function loadContent() {
    let section = window.location.hash.substring(1);
    if (!section) section = "home";
    if (section.startsWith("article_")) {
      renderArticlePage(section.substring(8));
      return;
    }
    if (section.startsWith("account_")) {
      renderAccountDetail(section.substring(8));
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
      case "resultados":
        renderResultsPage();
        break;
      case "calculators":
        renderCalculatorsPage();
        break;
      case "cryptos":
        renderCryptosPage();
        break;
      case "accounts":
        renderAccountsPage();
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

  // Nova lógica da sessão (para scalping)
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

  // Função para gerar dados de candlestick a partir dos trades (para scalping)
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

  // Inicializa o gráfico de candlestick para scalping (necessário o plugin chartjs-chart-financial)
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

  // --- FUNÇÕES PARA MÉTRICAS ADICIONAIS (Scalping) ---
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

  // --- TERMINAR SESSÃO E ARMAZENAR NO FIRESTORE (Scalping) ---
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

  // --- CALCULATORS SECTION ---
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

  // --- RESULTADOS: RENDERIZAÇÃO DOS DADOS COM FILTRO ---
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

  // --- NOVA ABA: ACCOUNTS (Swing Trading) ---
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
        html += `<div class="account-card" onclick="window.location.hash='account_${acc.id}'" style="cursor:pointer;">
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

         <!-- ESTATÍSTICAS EXISTENTES E NOVAS -->
         <div class="account-stats">
           <h3>Statistics</h3>
           <div class="stats-cards" id="accountStatsCards"></div>
         </div>

         <!-- NOVA SEÇÃO: RISCO -->
         <div class="risk-stats">
           <h3>Risk Parameters</h3>
           <div class="stats-cards" id="riskStatsCards"></div>
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

    // Eventos de botões
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

    // Renderização das estatísticas e gráficos
    renderAccountStats(account);
    renderRiskStats(account);
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
    // Calcular métricas adicionais:
    const trades = account.trades || [];
    let runningBalance = account.initialBalance;
    let peak = runningBalance;
    let maxDrawdownVal = 0;
    let bestBalance = runningBalance;

    let totalSwingProfit = 0;
    let swingCount = 0;
    let swingProfitPercentages = [];
    let depositSum = 0;

    // Iterar em ordem cronológica
    const sortedTrades = [...trades].sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedTrades.forEach(t => {
      if (t.type === "deposit") {
        depositSum += t.value;
        runningBalance += t.value;
      } else if (t.type === "withdrawal") {
        runningBalance += t.value; // valor já é negativo
      } else if (t.type === "swing") {
        // Cálculo de lucro em $ e porcentagem
        totalSwingProfit += t.value;
        const profitPct = (t.value / runningBalance) * 100;
        swingProfitPercentages.push(profitPct);
        swingCount++;
        runningBalance += t.value;
      }
      // Atualizar peak e drawdown
      if (runningBalance > peak) peak = runningBalance;
      const drawdownPct = ((peak - runningBalance) / peak) * 100;
      if (drawdownPct > maxDrawdownVal) {
        maxDrawdownVal = drawdownPct;
      }
      // Atualizar melhor saldo
      if (runningBalance > bestBalance) {
        bestBalance = runningBalance;
      }
    });

    // Percentagem feita acima dos depósitos
    let percentAboveDeposits = "N/A";
    if (depositSum > 0) {
      percentAboveDeposits = ((totalSwingProfit / depositSum) * 100).toFixed(2) + "%";
    }

    // Média de lucro por trade (porcentagem)
    let avgProfitPct = "0.00%";
    if (swingProfitPercentages.length > 0) {
      const somaPct = swingProfitPercentages.reduce((acc, p) => acc + p, 0);
      avgProfitPct = (somaPct / swingProfitPercentages.length).toFixed(2) + "%";
    }

    // Máximo drawdown em porcentagem
    const maxDrawdownDisplay = maxDrawdownVal.toFixed(2) + "%";

    // Melhor saldo obtido
    const bestBalanceDisplay = `$${bestBalance.toFixed(2)}`;

    // CRUD das estatísticas originais (total trades, total gain/loss, win rate)
    const totalTrades = trades.length;
    const totalGainLoss = trades.reduce((sum, t) => sum + t.value, 0);
    const wins = trades.filter(t => t.value > 0).length;
    const winRate = totalTrades ? ((wins / totalTrades) * 100).toFixed(2) + "%" : "0.00%";

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
        <p>${winRate}</p>
      </div>
      <div class="stats-card">
        <h3>Percent Above Deposits</h3>
        <p>${percentAboveDeposits}</p>
      </div>
      <div class="stats-card">
        <h3>Avg Profit/Trade</h3>
        <p>${avgProfitPct}</p>
      </div>
      <div class="stats-card">
        <h3>Max Drawdown</h3>
        <p>${maxDrawdownDisplay}</p>
      </div>
      <div class="stats-card">
        <h3>Best Balance</h3>
        <p>${bestBalanceDisplay}</p>
      </div>
    `;
    document.getElementById("accountStatsCards").innerHTML = statsHTML;
  }

  function renderRiskStats(account) {
    const currentBalance = account.currentBalance;
    // 5% do saldo atual por trade
    const riskPerTrade = (0.05 * currentBalance).toFixed(2);
    // 15% de prejuízo máximo por dia (sobre o saldo atual)
    const maxLossPerDay = (0.15 * currentBalance).toFixed(2);
    // Meta ideal de 20% sobre o valor do saldo
    const targetProfit = (0.20 * currentBalance).toFixed(2);

    const riskHTML = `
      <div class="stats-card">
        <h3>Risk per Trade (5%)</h3>
        <p>$${riskPerTrade}</p>
      </div>
      <div class="stats-card">
        <h3>Max Loss per Day (15%)</h3>
        <p>$${maxLossPerDay}</p>
      </div>
      <div class="stats-card">
        <h3>Target Profit (20%)</h3>
        <p>$${targetProfit}</p>
      </div>
    `;
    document.getElementById("riskStatsCards").innerHTML = riskHTML;
  }

  function renderAccountHistory(account) {
    const tbody = document.querySelector("#accountHistoryTable tbody");
    tbody.innerHTML = "";
    (account.trades || []).forEach((t, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
         <td>${index + 1}</td>
         <td>${t.type}</td>
         <td>$${t.value.toFixed(2)}</td>
         <td>${new Date(t.date).toLocaleString()}</td>
         <td><button class="remove-account-trade" data-index="${index}">X</button></td>
      `;
      tbody.appendChild(row);
    });
    document.querySelectorAll(".remove-account-trade").forEach(btn => {
      btn.addEventListener("click", async function() {
         const index = parseInt(this.getAttribute("data-index"));
         let updatedTrades = account.trades || [];
         const removed = updatedTrades.splice(index, 1)[0];
         const newBalance = account.currentBalance - removed.value;
         try {
            await updateDoc(doc(db, "accounts", account.id), {
               trades: updatedTrades,
               currentBalance: newBalance
            });
            renderAccountDetail(account.id);
         } catch(err) {
            alert("Error removing trade: " + err.message);
         }
      });
    });
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

});
