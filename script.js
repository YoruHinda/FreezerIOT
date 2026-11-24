// ==================================
// CONFIGURACAO DO THINGSPEAK
// Preencha os tres valores abaixo.
// A Write API Key fica visivel no navegador.
// Para uso real, proteja a escrita com um backend.
// ==================================
const CHANNEL_ID = "3558597";
const READ_API_KEY = "0ZLJ4CQJG5ASKVVC"; // Vazio se o canal for publico
const WRITE_API_KEY = "7X2U5SZBFBR8YU84";

const API_BASE = "https://api.thingspeak.com";
const REFRESH_INTERVAL = 20000;

let feeds = [];
let ultimoStatus = null;
let ultimoEntryId = null;
let ultimoLimiteAplicado = null;
let ultimoLimiteRemoto = null;

const $ = (id) => document.getElementById(id);

function montarUrlLeitura() {
    let url = `${API_BASE}/channels/${encodeURIComponent(CHANNEL_ID)}/feeds.json?results=100`;
    if (READ_API_KEY) url += `&api_key=${encodeURIComponent(READ_API_KEY)}`;
    return url;
}

// Escolhe o registro mais recente que contenha temperatura e limite.
// O Field 4 e procurado separadamente porque os comandos remotos
// geram registros que nao possuem Field 1, 2 e 3.
function obterUltimosValores(lista) {
    const amostras = lista.filter(feed =>
        feed.field1 !== null && feed.field1 !== "" &&
        feed.field2 !== null && feed.field2 !== ""
    );

    const comandos = lista.filter(feed =>
        feed.field4 !== null && feed.field4 !== "" &&
        Number.isFinite(Number(feed.field4))
    );

    return {
        amostra: amostras.length ? amostras[amostras.length - 1] : null,
        comando: comandos.length ? comandos[comandos.length - 1] : null
    };
}

async function buscarDados() {
    if (!CHANNEL_ID || CHANNEL_ID === "SEU_CHANNEL_ID") {
        atualizarConexao(false, "Configure o CHANNEL_ID no script.js");
        return;
    }

    try {
        const resposta = await fetch(montarUrlLeitura(), { cache: "no-store" });
        if (!resposta.ok) throw new Error("Não foi possível acessar o canal ThingSpeak.");

        const dados = await resposta.json();
        if (!dados.feeds || !dados.feeds.length) {
            atualizarConexao(false, "Canal sem medições");
            return;
        }

        feeds = dados.feeds;
        const { amostra, comando } = obterUltimosValores(feeds);

        if (!amostra) {
            atualizarConexao(false, "Sem medições válidas");
            return;
        }

        atualizarTemperatura(amostra);

        if (comando) {
            ultimoLimiteRemoto = Number(comando.field4);
            verificarSincronizacao(Number(amostra.field2), ultimoLimiteRemoto);
        }

        atualizarGrafico();
        atualizarConexao(true, "Conectado ao ThingSpeak");
    } catch (erro) {
        console.error(erro);
        atualizarConexao(false, "Falha na conexão");
        $("message").textContent = erro.message;
    }
}

function identificarStatus(temp, limite, codigo) {
    if (codigo !== null && codigo !== undefined && codigo !== "") {
        const valor = Number(codigo);
        if (valor === 1) return "normal";
        if (valor === 2) return "attention";
        if (valor === 3) return "critical";
    }
    if (temp <= limite) return "normal";
    if (temp <= limite + 2) return "attention";
    return "critical";
}

function atualizarTemperatura(feed) {
    const temperatura = Number(feed.field1);
    const limite = Number(feed.field2);
    const estado = identificarStatus(temperatura, limite, feed.field3);

    $("temperature").textContent = `${temperatura.toFixed(1)} °C`;
    $("limit").textContent = `${limite.toFixed(1)} °C`;
    ultimoLimiteAplicado = limite;

    const statusElement = $("status");
    statusElement.className = `status ${estado}`;

    const nomes = {
        normal: "NORMAL",
        attention: "ATENÇÃO",
        critical: "CRÍTICO"
    };
    const descricoes = {
        normal: "Temperatura dentro do limite",
        attention: "Temperatura próxima do limite",
        critical: "Temperatura acima da faixa permitida"
    };

    statusElement.textContent = nomes[estado];
    $("statusDescription").textContent = descricoes[estado];
    $("lastUpdate").textContent =
        "Última leitura: " + new Date(feed.created_at).toLocaleString("pt-BR");

    atualizarAlertaCritico(estado, temperatura, limite);
    verificarAlerta(estado, temperatura, feed.entry_id);
}

function atualizarAlertaCritico(estado, temperatura, limite) {
    const banner = $("criticalBanner");
    if (estado === "critical") {
        banner.hidden = false;
        $("criticalMessage").textContent =
            `Temperatura em ${temperatura.toFixed(1)} °C. O limite configurado é ${limite.toFixed(1)} °C. Verifique o freezer imediatamente.`;
    } else {
        banner.hidden = true;
    }
}

function verificarAlerta(estado, temperatura, entryId) {
    if (entryId === ultimoEntryId) return;
    ultimoEntryId = entryId;

    if (ultimoStatus !== null && ultimoStatus !== estado) {
        if (estado === "attention" || estado === "critical") {
            adicionarAlerta(
                estado,
                temperatura,
                estado === "critical"
                    ? "Temperatura em estado crítico"
                    : "Temperatura em estado de atenção"
            );
        }
    } else if (ultimoStatus === null && estado === "critical") {
        adicionarAlerta("critical", temperatura, "Temperatura já estava em estado crítico");
    }

    ultimoStatus = estado;
}

function adicionarAlerta(tipo, temperatura, mensagem) {
    const area = $("alerts");
    const vazio = area.querySelector(".empty");
    if (vazio) vazio.remove();

    const alerta = document.createElement("div");
    alerta.className = tipo === "critical" ? "alert critical" : "alert";

    const titulo = document.createElement("strong");
    titulo.textContent = mensagem;

    const detalhe = document.createElement("small");
    detalhe.textContent =
        `${temperatura.toFixed(1)} °C · ${new Date().toLocaleString("pt-BR")}`;

    alerta.append(titulo, detalhe);
    area.prepend(alerta);

    while (area.children.length > 6) area.lastElementChild.remove();
}

function verificarSincronizacao(aplicado, solicitado) {
    const pendente = Math.abs(aplicado - solicitado) >= 0.05;
    $("syncStatus").textContent = pendente
        ? `Aguardando o ESP32 aplicar ${solicitado.toFixed(1)} °C. Limite atual no equipamento: ${aplicado.toFixed(1)} °C.`
        : `Sincronizado. ESP32 e dashboard estão usando ${aplicado.toFixed(1)} °C.`;
    $("syncStatus").classList.toggle("pending", pendente);
}

async function enviarLimiteRemoto(event) {
    event.preventDefault();

    if (!CHANNEL_ID || CHANNEL_ID === "SEU_CHANNEL_ID" ||
        !WRITE_API_KEY || WRITE_API_KEY === "SUA_WRITE_API_KEY") {
        $("message").textContent = "Configure CHANNEL_ID e WRITE_API_KEY no script.js.";
        return;
    }

    const novoLimite = Number($("remoteLimit").value);
    if (!Number.isFinite(novoLimite) || novoLimite < -40 || novoLimite > 15) {
        $("message").textContent = "Informe um limite entre -40 °C e 15 °C.";
        return;
    }

    const botao = $("limitButton");
    botao.disabled = true;
    botao.textContent = "Enviando...";

    try {
        const url = `${API_BASE}/update?api_key=${encodeURIComponent(WRITE_API_KEY)}&field4=${encodeURIComponent(novoLimite.toFixed(1))}`;
        const resposta = await fetch(url, { method: "GET", cache: "no-store" });

        if (!resposta.ok) throw new Error("Falha ao enviar o limite.");

        const retorno = (await resposta.text()).trim();
        if (retorno === "0") {
            throw new Error("ThingSpeak não aceitou o envio. Aguarde o intervalo mínimo de 15 segundos e tente novamente.");
        }

        ultimoLimiteRemoto = novoLimite;
        $("message").textContent = "Solicitação enviada. Aguardando confirmação do ESP32...";
        $("syncStatus").textContent =
            `Solicitado: ${novoLimite.toFixed(1)} °C. O equipamento aplicará o valor na próxima consulta.`;
        $("syncStatus").classList.add("pending");
        $("remoteLimit").value = "";
        setTimeout(buscarDados, 2500);
    } catch (erro) {
        console.error(erro);
        $("message").textContent = erro.message;
    } finally {
        botao.disabled = false;
        botao.textContent = "Atualizar limite";
    }
}

function atualizarConexao(conectado, mensagem) {
    $("connectionDot").style.background = conectado ? "#39845c" : "#c94d48";
    $("connectionText").textContent = mensagem;
}

function atualizarGrafico() {
    const canvas = $("temperatureChart");
    const ctx = canvas.getContext("2d");
    const largura = canvas.clientWidth;
    const altura = canvas.clientHeight;
    const escala = window.devicePixelRatio || 1;

    canvas.width = largura * escala;
    canvas.height = altura * escala;
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    ctx.clearRect(0, 0, largura, altura);

    const valores = feeds
        .filter(feed => feed.field1 !== null && feed.field2 !== null)
        .map(feed => ({
            temperatura: Number(feed.field1),
            limite: Number(feed.field2)
        }));

    if (!valores.length) return;

    const todos = valores.flatMap(item => [item.temperatura, item.limite]);
    let minimo = Math.min(...todos) - 2;
    let maximo = Math.max(...todos) + 2;
    if (maximo === minimo) { maximo += 1; minimo -= 1; }

    const margem = { top: 15, bottom: 25, left: 35, right: 10 };
    const graficoLargura = largura - margem.left - margem.right;
    const graficoAltura = altura - margem.top - margem.bottom;

    const posX = index => margem.left +
        (index / Math.max(valores.length - 1, 1)) * graficoLargura;
    const posY = valor => margem.top +
        ((maximo - valor) / (maximo - minimo)) * graficoAltura;

    ctx.strokeStyle = "#edf0ed";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = margem.top + (graficoAltura / 4) * i;
        ctx.beginPath();
        ctx.moveTo(margem.left, y);
        ctx.lineTo(largura - margem.right, y);
        ctx.stroke();
    }

    ctx.fillStyle = "#89928d";
    ctx.font = "11px Arial";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
        const valor = maximo - ((maximo - minimo) / 4) * i;
        const y = margem.top + (graficoAltura / 4) * i;
        ctx.fillText(`${valor.toFixed(1)}°`, margem.left - 6, y + 4);
    }

    // Linha do limite
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "#c18a37";
    valores.forEach((item, index) => {
        const x = posX(index), y = posY(item.limite);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Linha da temperatura
    ctx.beginPath();
    ctx.strokeStyle = "#477d61";
    ctx.lineWidth = 2.5;
    valores.forEach((item, index) => {
        const x = posX(index), y = posY(item.temperatura);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    valores.forEach((item, index) => {
        ctx.beginPath();
        ctx.arc(posX(index), posY(item.temperatura), 3, 0, Math.PI * 2);
        ctx.fillStyle = "#477d61";
        ctx.fill();
    });

    ctx.textAlign = "left";
    ctx.fillStyle = "#477d61";
    ctx.fillText("Temperatura", margem.left, altura - 3);
    ctx.fillStyle = "#c18a37";
    ctx.fillText("Limite", margem.left + 100, altura - 3);
}

$("limitForm").addEventListener("submit", enviarLimiteRemoto);

if (CHANNEL_ID && CHANNEL_ID !== "SEU_CHANNEL_ID") {
    buscarDados();
} else {
    atualizarConexao(false, "Configure o CHANNEL_ID no script.js");
}

setInterval(buscarDados, REFRESH_INTERVAL);
window.addEventListener("resize", atualizarGrafico);
