document.addEventListener("DOMContentLoaded", function() {
  // Global variables for authentication and data
  let currentUser = JSON.parse(localStorage.getItem("currentUser")) || null;
  let sessionHistory = [];

  // Dummy articles for Home feed
  const dummyArticles = [
    {
      id: 1,
      author: "AnalystX",
      title: "Market on the Rise!",
      content: "Full article content. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Curabitur pretium tincidunt lacus.",
      date: new Date().toLocaleString()
    },
    {
      id: 2,
      author: "TraderY",
      title: "Daily Tip: Risk Management",
      content: "Full article content. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Pellentesque habitant morbi tristique senectus et netus.",
      date: new Date().toLocaleString()
    }
  ];

  // Variables for active trading session
  let sessionStartTime;
  let sessionTimerInterval;
  let sessionData = {
    initialBank: 0,
    type: "normal",
    trades: [],
    riskPerTrade: 0,
    maxTrades: 0,
    objectivePercent: 0
  };

  // Chart variables
  let performanceChart; // Session performance chart
  let resultsChart;     // Results bar chart

  // Mapping for menu icons (Font Awesome)
  const iconMap = {
    home: '<i class="fas fa-home menu-icon"></i>',
    sessao: '<i class="fas fa-chart-line menu-icon"></i>',
    resultados: '<i class="fas fa-table menu-icon"></i>',
    calculators: '<i class="fas fa-calculator menu-icon"></i>',
    perfil: '<i class="fas fa-user menu-icon"></i>',
    login: '<i class="fas fa-sign-in-alt menu-icon"></i>'
  };

  // Update menu with icons and text
  function updateMenu() {
    const menuLinks = document.getElementById("menuLinks");
    menuLinks.innerHTML = "";
    let items = [];
    if (currentUser) {
      items = [
        { hash: "#home", label: "Home", key: "home" },
        { hash: "#sessao", label: "Session", key: "sessao" },
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
      userStatus.innerHTML = `Hello, <strong>${currentUser.username}</strong> | <a href="#" id="logoutLink">Logout</a>`;
      document.getElementById("logoutLink").addEventListener("click", logout);
    } else {
      userStatus.innerHTML = `<a href="#login">Login</a>`;
    }
  }

  // Sidebar toggle functionality
  document.getElementById("sidebarToggle").addEventListener("click", function() {
    const sidebar = document.getElementById("sidebar");
    sidebar.classList.toggle("collapsed");
    const logoImg = document.getElementById("logoImg");
    if (sidebar.classList.contains("collapsed")) {
      logoImg.src = "traydayicon.png";
    } else {
      logoImg.src = "trayday.png";
    }
  });

  // Load content based on URL hash
  function loadContent() {
    let section = window.location.hash.substring(1);
    if (!section) section = "home";
    if (section.startsWith("article_")) {
      renderArticlePage(section.substring(8));
      return;
    }
    if ((section === "perfil" || section === "calculators" || section === "sessao" || section === "resultados") && !currentUser) {
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
      default:
        document.getElementById("mainContent").innerHTML = `<h2>Section not found</h2>`;
    }
    document.querySelectorAll(".sidebar ul li a").forEach(link => {
      if (link.getAttribute("data-section") === section) {
        link.classList.add("active");
      } else {
        link.classList.remove("active");
      }
    });
  }

  window.addEventListener("hashchange", loadContent);
  updateMenu();
  loadContent();

  // --- LOGIN SECTION ---
  function renderLogin() {
    const loginHTML = `
      <h2>Login</h2>
      <div class="login-form">
        <label for="username">Username:</label>
        <input type="text" id="username" placeholder="Enter your username" />
        <label for="password">Password:</label>
        <input type="password" id="password" placeholder="Enter your password" />
        <button id="loginBtn">Login</button>
      </div>
    `;
    document.getElementById("mainContent").innerHTML = loginHTML;
    document.getElementById("loginBtn").addEventListener("click", doLogin);
  }

  function doLogin() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    if (username === "" || password === "") {
      alert("Please fill in all fields.");
      return;
    }
    currentUser = { username };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));
    updateMenu();
    window.location.hash = "home";
  }

  function logout(e) {
    e.preventDefault();
    currentUser = null;
    localStorage.removeItem("currentUser");
    updateMenu();
    window.location.hash = "login";
  }

  // --- HOME SECTION ---
  function renderHome() {
    let postsHTML = "";
    dummyArticles.forEach(article => {
      postsHTML += `
        <a href="#article_${article.id}" class="article-link">
          <div class="post">
            <div class="post-header">
              <span><strong>${article.author}</strong></span>
              <span>${article.date}</span>
            </div>
            <div class="post-body">
              <h3>${article.title}</h3>
              <p>${article.content.substring(0, 100)}...</p>
            </div>
          </div>
        </a>
      `;
    });
    const homeHTML = `
      <h2>Feed</h2>
      <p>Stay updated with the latest news, analyses, and trading tips.</p>
      <div id="feedPosts">${postsHTML}</div>
    `;
    document.getElementById("mainContent").innerHTML = homeHTML;
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
        <p class="article-meta">By <strong>${article.author}</strong> | ${article.date}</p>
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
      <p><strong>Username:</strong> ${currentUser.username}</p>
      <p>Manage your information, view your posts, and track your activity.</p>
    `;
    document.getElementById("mainContent").innerHTML = profileHTML;
  }

  // --- TRADING SESSION SECTION ---
  function renderSessionStart() {
    const sessionStartHTML = `
      <h2>Start Trading Session</h2>
      <div class="session-form">
        <label for="initialBank">Initial Bank ($):</label>
        <input type="number" id="initialBank" placeholder="e.g., 1000" min="0" />
        <label for="sessionType">Session Type:</label>
        <select id="sessionType">
          <option value="normal">Normal</option>
          <option value="aggressive">Aggressive</option>
        </select>
        <button id="startSessionBtn">Start Session</button>
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
    if (type === "normal") {
      sessionData.riskPerTrade = 0.03 * initialBank;
      sessionData.maxTrades = 5;
      sessionData.objectivePercent = 10;
    } else if (type === "aggressive") {
      sessionData.riskPerTrade = 0.06 * initialBank;
      sessionData.maxTrades = 3;
      sessionData.objectivePercent = 20;
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

  // --- Session Dashboard Layout (modules) ---
  function renderSessionDashboard() {
    const dashboardHTML = `
      <div class="dashboard">
        <div class="dashboard-header">
          <h2>Session Dashboard</h2>
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
            <label for="tradeValue">Trade Value ($) (positive = gain, negative = loss):</label>
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
        const idx = parseInt(this.getAttribute("data-index"));
        removeTrade(idx);
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

  function terminateSession() {
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
      id: sessionHistory.length + 1,
      startTime: sessionStartTime,
      endTime: endTime,
      duration: totalDuration,
      initialBank: sessionData.initialBank,
      totalTrades: totalTrades,
      totalGainLoss: totalGainLoss,
      accuracy: accuracy,
      type: sessionData.type
    };
    sessionHistory.push(sessionSummary);
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

  function exportSessionResults() {
    const lastSession = sessionHistory[sessionHistory.length - 1];
    let textContent = "Session Summary\n";
    textContent += "--------------------\n";
    textContent += "Start: " + lastSession.startTime.toLocaleString() + "\n";
    textContent += "End: " + lastSession.endTime.toLocaleString() + "\n";
    textContent += "Duration: " + lastSession.duration + "\n";
    textContent += "Initial Bank: $" + lastSession.initialBank.toFixed(2) + "\n";
    textContent += "Total Trades: " + lastSession.totalTrades + "\n";
    textContent += "Total Gain/Loss: $" + lastSession.totalGainLoss.toFixed(2) + "\n";
    textContent += "Accuracy: " + lastSession.accuracy + "%\n";
    
    const endDate = new Date(lastSession.endTime);
    const year = endDate.getFullYear();
    const month = ("0" + (endDate.getMonth() + 1)).slice(-2);
    const day = ("0" + endDate.getDate()).slice(-2);
    const hours = ("0" + endDate.getHours()).slice(-2);
    const minutes = ("0" + endDate.getMinutes()).slice(-2);
    const seconds = ("0" + endDate.getSeconds()).slice(-2);
    const formattedDate = `${year}${month}${day}_${hours}${minutes}${seconds}`;
    
    const blob = new Blob([textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `session_summary_${formattedDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // --- RESULTS SECTION (Enhanced Layout) ---
  function parseDuration(durationStr) {
    const parts = durationStr.split(":");
    if (parts.length !== 3) return 0;
    const hours = parseInt(parts[0]);
    const minutes = parseInt(parts[1]);
    const seconds = parseInt(parts[2]);
    return hours * 3600 + minutes * 60 + seconds;
  }

  function formatDuration(totalSeconds) {
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  function getAggregateStats() {
    const totalSessions = sessionHistory.length;
    let totalTrades = 0;
    let totalGainLoss = 0;
    let sumProfitPercent = 0;
    let totalDurationSeconds = 0;
    let bestSession = null;
    let worstSession = null;
    let totalAccuracy = 0;
    
    sessionHistory.forEach(s => {
      totalTrades += s.totalTrades;
      totalGainLoss += s.totalGainLoss;
      const profitPercent = (s.totalGainLoss / s.initialBank) * 100;
      sumProfitPercent += profitPercent;
      totalDurationSeconds += parseDuration(s.duration);
      totalAccuracy += parseFloat(s.accuracy);
      if (bestSession === null || s.totalGainLoss > bestSession) {
        bestSession = s.totalGainLoss;
      }
      if (worstSession === null || s.totalGainLoss < worstSession) {
        worstSession = s.totalGainLoss;
      }
    });
    
    const avgProfitPercent = totalSessions > 0 ? sumProfitPercent / totalSessions : 0;
    const avgAccuracy = totalSessions > 0 ? totalAccuracy / totalSessions : 0;
    const avgDurationSeconds = totalSessions > 0 ? totalDurationSeconds / totalSessions : 0;
    const avgDuration = formatDuration(Math.round(avgDurationSeconds));
    
    return {
      totalSessions,
      totalTrades,
      totalGainLoss,
      avgProfitPercent,
      bestSession: bestSession || 0,
      worstSession: worstSession || 0,
      avgAccuracy,
      avgDuration
    };
  }

  function renderResultsPage() {
    const stats = getAggregateStats();
    const aggHTML = `
      <div class="aggregate-stats">
        <h3>Overall Performance</h3>
        <p><strong>Total Sessions:</strong> ${stats.totalSessions}</p>
        <p><strong>Total Trades:</strong> ${stats.totalTrades}</p>
        <p><strong>Total Gain/Loss:</strong> $${stats.totalGainLoss.toFixed(2)}</p>
        <p><strong>Average Profit (%):</strong> ${stats.avgProfitPercent.toFixed(2)}%</p>
        <p><strong>Average Session Duration:</strong> ${stats.avgDuration}</p>
        <p><strong>Best Session:</strong> $${stats.bestSession.toFixed(2)}</p>
        <p><strong>Worst Session:</strong> $${stats.worstSession.toFixed(2)}</p>
        <p><strong>Average Accuracy:</strong> ${stats.avgAccuracy.toFixed(2)}%</p>
      </div>
    `;
    const resultsHTML = `
      <h2>Session Results</h2>
      ${aggHTML}
      <!-- Row with two modules: Bar Chart and Pie Chart -->
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
      <!-- Full width session table -->
      <div class="dashboard-row">
        <div class="dashboard-column full-width">
          <h3>Detailed Session Table</h3>
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
    `;
    document.getElementById("mainContent").innerHTML = resultsHTML;
    renderResultsTable(sessionHistory);
    initResultsBarChart(sessionHistory);
    initResultsPieChart(sessionHistory);
  }

  function renderResultsTable(sessions) {
    const tbody = document.querySelector("#resultsTable tbody");
    tbody.innerHTML = "";
    sessions.forEach(s => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${s.id}</td>
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
        labels: sessions.map(s => `Session ${s.id}`),
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

  // --- CALCULATORS SECTION (Two columns on desktop) ---
  function renderCalculatorsPage() {
    const calculatorsHTML = `
      <h2>Calculators</h2>
      <div class="calc-row">
        <div class="calc-column">
          <div class="calculators-section" id="riskCalculator">
            <h3>Risk Calculator</h3>
            <label for="riskInitialBank">Initial Bank ($):</label>
            <input type="number" id="riskInitialBank" placeholder="Enter your bank" />
            <label for="riskPercentage">Risk Percentage (%):</label>
            <input type="number" id="riskPercentage" placeholder="Enter risk percentage" />
            <button id="calcRiskBtn">Calculate Risk</button>
            <p id="riskResult"></p>
          </div>
        </div>
        <div class="calc-column">
          <div class="calculators-section" id="compoundCalculator">
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
      </div>
      <div class="calc-row">
        <div class="calc-column">
          <div class="calculators-section" id="predictionCalculator">
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
        <div class="calc-column">
          <div class="calculators-section" id="stopLossCalculator">
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
    document.getElementById("calcRiskBtn").addEventListener("click", calcRisk);
    document.getElementById("calcCompoundBtn").addEventListener("click", calcCompound);
    document.getElementById("calcPredictionBtn").addEventListener("click", calcPrediction);
    document.getElementById("calcStopLossBtn").addEventListener("click", calcStopLoss);
  }

  // Calculator functions
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
