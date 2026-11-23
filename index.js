const $ = id => document.getElementById(id);
    let temp = -18, limit = -18, history = [], alerts = [], lastState = 'normal', ticks = 0;

function fmt(v) { return Number(v).toFixed(1).replace('.', ',') + ' °C' }
function stateFor(v) { if (v <= limit) return 'normal'; if (v <= limit + 3) return 'atencao'; return 'critico' }
function addAlert(type, title, detail) { alerts.unshift({ type, title, detail, time: new Date().toLocaleTimeString('pt-BR') }); alerts = alerts.slice(0, 5); renderAlerts() }
function renderAlerts() { let box = $('alertList'); if (!alerts.length) { box.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:12px 0">Nenhum alerta registrado.</div>'; return } box.innerHTML = alerts.map(a => `<div class="alert"><div class="alert-icon ${a.type === 'red' ? 'red' : ''}">${a.type === 'red' ? '!' : '✓'}</div><div><b>${a.title}</b><small>${a.detail} · ${a.time}</small></div></div>`).join('') }
function update() {
    let s = stateFor(temp); $('currentTemp').textContent = fmt(temp); $('limitDisplay').textContent = fmt(limit); $('stateText').textContent = s === 'normal' ? 'Normal' : s === 'atencao' ? 'Atenção' : 'Crítico'; $('stateText').style.color = s === 'normal' ? 'var(--green)' : s === 'atencao' ? 'var(--yellow)' : 'var(--red)'; $('stateSub').textContent = s === 'normal' ? 'Dentro da faixa configurada' : s === 'atencao' ? 'Temperatura próxima do limite' : 'Temperatura acima do limite'; $('globalStatus').className = 'status ' + (s === 'normal' ? '' : s === 'atencao' ? 'warn' : 'critical'); $('globalStatus').textContent = s === 'normal' ? '● Normal' : s === 'atencao' ? '● Atenção' : '● Crítico'; $('alertBadge').className = 'status ' + (s === 'normal' ? '' : s === 'atencao' ? 'warn' : 'critical'); $('alertBadge').textContent = s === 'normal' ? 'Tudo certo' : s === 'atencao' ? 'Atenção' : 'Alerta ativo'; $('equipStatus').className = 'status ' + (s === 'normal' ? '' : s === 'atencao' ? 'warn' : 'critical'); $('equipStatus').textContent = s === 'normal' ? 'Conectado · Normal' : s === 'atencao' ? 'Conectado · Atenção' : 'Conectado · Crítico'; $('lastRead').textContent = 'Última leitura às ' + new Date().toLocaleTimeString('pt-BR');
    if (s !== lastState) { if (s === 'atencao') addAlert('green', 'Temperatura em atenção', 'Leitura ' + fmt(temp)); if (s === 'critico') addAlert('red', 'Temperatura crítica', 'Leitura ' + fmt(temp) + ' acima do limite'); if (s === 'normal' && lastState !== 'normal') addAlert('green', 'Temperatura normalizada', 'Leitura ' + fmt(temp)); lastState = s }
    history.push(temp); if (history.length > 36) history.shift(); drawChart()
}
function drawChart() { let c = $('chart'), ctx = c.getContext('2d'), w = c.width, h = c.height; ctx.clearRect(0, 0, w, h); let p = { l: 45, r: 12, t: 12, b: 27 }, cw = w - p.l - p.r, ch = h - p.t - p.b, min = -30, max = 10; ctx.font = '11px Arial'; ctx.strokeStyle = '#edf0ec'; ctx.fillStyle = '#879087'; for (let v = -30; v <= 10; v += 10) { let y = p.t + (max - v) / (max - min) * ch; ctx.beginPath(); ctx.moveTo(p.l, y); ctx.lineTo(w - p.r, y); ctx.stroke(); ctx.fillText(v + '°', 7, y + 4) } let ly = p.t + (max - limit) / (max - min) * ch; ctx.strokeStyle = '#c49a4a'; ctx.setLineDash([5, 5]); ctx.beginPath(); ctx.moveTo(p.l, ly); ctx.lineTo(w - p.r, ly); ctx.stroke(); ctx.setLineDash([]); if (history.length > 1) { ctx.strokeStyle = '#36785a'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.beginPath(); history.forEach((v, i) => { let x = p.l + i / Math.max(35, history.length - 1) * cw, y = p.t + (max - v) / (max - min) * ch; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) }); ctx.stroke() } ctx.fillStyle = '#879087'; ctx.fillText('Registros', p.l, h - 5) }
function tick() { ticks++; temp = Math.max(-29, Math.min(9, temp + (Math.random() - .52) * .8)); temp = Math.round(temp * 10) / 10; update(); $('clock').textContent = new Date().toLocaleTimeString('pt-BR') }
for (let i = 0; i < 18; i++)history.push(-18 + (Math.random() - .5) * .8); update(); $('clock').textContent = new Date().toLocaleTimeString('pt-BR'); setInterval(tick, 3000);
window.addEventListener('resize', drawChart);

function salvarLimite() {
    const novoLimite = Number(
        document.getElementById("limiteTemperatura").value
    );

    const mensagem = document.getElementById("mensagemConfig");

    if (!Number.isFinite(novoLimite) || novoLimite < -40 || novoLimite > 15) {
        mensagem.textContent = "Informe uma temperatura entre -40°C e 15°C.";
        mensagem.style.color = "#b94c46";
        return;
    }

    // Atualiza o limite utilizado pelo dashboard
    limit = novoLimite;

    // Atualiza o valor exibido
    document.getElementById("limitDisplay").textContent =
        limit.toFixed(1).replace(".", ",") + " °C";

    mensagem.textContent = "Limite atualizado com sucesso!";
    mensagem.style.color = "#36785a";

    // Atualiza os indicadores e o gráfico
    lastState = "";
    update();
}