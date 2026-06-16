let questoes = [];
let indiceAtual = 0;
let indiceMaxRespondido = -1;
let indiceMaxAlcancado = 0; // questão mais avançada já alcançada (só avança ao passar pela liberação)
let respostasPorQuestao = {};
let dicasUsadas = {}; // questões em que o aluno pediu a dica voluntariamente (custo de 5 pontos)
let tentativas = 0;
let pontosTotais = 0;
let testeId = "";

// Variáveis de Controle do Aluno e Tempo
let alunoNomeOriginal = "";
let alunoNomeNormalizado = "";
let tempoInicioQuestao = 0;

const urlParams = new URLSearchParams(window.location.search);
testeId = urlParams.get('teste');

async function inicializar() {


    alunoNomeOriginal = localStorage.getItem("atual_aluno_nome_original") || "";
    alunoNomeNormalizado = localStorage.getItem("atual_aluno_nome_normalizado") || "";

    if (!alunoNomeNormalizado) {
        document.getElementById('container-login').style.display = 'block';
        document.getElementById('container-home').style.display = 'none';
        document.getElementById('container-jogo').style.display = 'none';
    } else {
        if (!testeId) {
            carregarMenuPrincipal();
        } else {
            carregarTesteEspecifico(testeId);
        }
    }
}

function entrarNaPlataforma() {
    const input = document.getElementById('input-aluno-nome').value.trim();
    if (!input) {
        alert("Por favor, digite um nome válido!");
        return;
    }

    alunoNomeOriginal = input.split(/\s+/).map(palavra => {
        return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    }).join(' ');

    alunoNomeNormalizado = alunoNomeOriginal
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .replace(/\s+/g, "_");

    localStorage.setItem("atual_aluno_nome_original", alunoNomeOriginal);
    localStorage.setItem("atual_aluno_nome_normalizado", alunoNomeNormalizado);

    document.getElementById('container-login').style.display = 'none';

    if (!testeId) {
        carregarMenuPrincipal();
    } else {
        carregarTesteEspecifico(testeId);
    }
}

async function carregarMenuPrincipal() {
    try {
        const response = await fetch('testes.md');
        const texto = await response.text();
        document.getElementById('container-home').style.display = 'block';
        document.getElementById('container-jogo').style.display = 'none';

        const lines = texto.split('\n');
        let htmlMenu = `<h1>🎯 Olá, ${alunoNomeOriginal}! Escolha seu desafio:</h1><ul class='lista-testes'>`;

        lines.forEach(linha => {
            if (linha.trim().startsWith('*')) {
                const nomeMatch = linha.match(new RegExp('\\[(.*?)\\]'));
                const linkMatch = linha.match(new RegExp('\\((.*?)\\)'));
                if (nomeMatch && linkMatch) {
                    htmlMenu += `<li><a class="card-teste" href="${linkMatch[1]}">${nomeMatch[1]}</a></li>`;
                }
            }
        });
        htmlMenu += "</ul>";
        htmlMenu += `<button class="btn" style="background:#e0e0e0; text-align:center;" onclick="fazerLogout()">Trocar de Aluno / Sair</button>`;
        document.getElementById('container-home').innerHTML = htmlMenu;
    } catch (e) {
        document.getElementById('container-home').innerHTML = "<h2>Erro ao carregar menu testes.md</h2>";
    }
}

async function carregarTesteEspecifico(id) {
    document.getElementById('container-home').style.display = 'none';
    document.getElementById('container-jogo').style.display = 'block';

    try {
        const response = await fetch(`simulados/${id}.md`);
        if (!response.ok) throw new Error();
        const textoMarkdown = await response.text();

        pontosTotais = parseInt(localStorage.getItem(`${alunoNomeNormalizado}_pontos_${id}`)) || 0;
        indiceAtual = parseInt(localStorage.getItem(`${alunoNomeNormalizado}_progresso_${id}`)) || 0;
        respostasPorQuestao = JSON.parse(localStorage.getItem(`${alunoNomeNormalizado}_respostas_${id}`) || '{}');
        dicasUsadas = JSON.parse(localStorage.getItem(`${alunoNomeNormalizado}_dicas_${id}`) || '{}');
        indiceMaxRespondido = getIndiceMaxRespondido();
        document.getElementById('placar').innerText = pontosTotais;

        // Reconstrói a fronteira alcançada ao recarregar: posição salva ou a questão seguinte à última respondida.
        indiceMaxAlcancado = Math.max(indiceAtual, indiceMaxRespondido + 1);

        const blocos = textoMarkdown.split('---');

        questoes = blocos.map((bloco, index) => {
            const imgMatch = bloco.match(new RegExp('!\\[.*?\\]\\((.*?)\\)'));
            const imagem = imgMatch ? imgMatch[1].trim() : "";
            const gabaritoMatch = bloco.match(new RegExp('gabarito:\\s*([A-E])', 'i'));
            const respostaCorreta = gabaritoMatch ? gabaritoMatch[1].toUpperCase() : "A";
            const videoMatch = bloco.match(new RegExp('v[ií]deo:\\s*(https?://[^\\s\\n]+)', 'i'));
            const video = videoMatch ? videoMatch[1].trim() : "";
            const dicaMatch = bloco.match(new RegExp('dica:\\s*(.*?)(?=\\n\\s*(explica[cç]ã[oō]|v[ií]deo:|$))', 'is'));
            const dica = dicaMatch ? dicaMatch[1].trim().replace(/\n/g, '<br>') : "Preste atenção nos detalhes.";
            const explMatch = bloco.match(new RegExp('explica[cç]ã[oō]:\\s*(.*?)(?=\\n\\s*(v[ií]deo:|$))', 'is'));
            const resolucaoTexto = explMatch ? explMatch[1].trim().replace(/\n/g, '<br>') : "";

            const linhas = bloco.split('\n');
            let alternativasEncontradas = [];
            let letrasOpcoes = ["A", "B", "C", "D", "E"];
            let contadorAlt = 0;

            linhas.forEach(linha => {
                const linhaLimpa = linha.trim();
                if (linhaLimpa.startsWith('-')) {
                    let textoAlternativa = linhaLimpa.replace('-', '').trim();
                    let letra = letrasOpcoes[contadorAlt] || "A";
                    if (!textoAlternativa.startsWith(letra)) textoAlternativa = `${letra}) ${textoAlternativa}`;
                    alternativasEncontradas.push({ letra: letra, texto: textoAlternativa });
                    contadorAlt++;
                }
            });

            if (alternativasEncontradas.length === 0 && !imagem) return null;

            return { id: index + 1, imagem: imagem, alternativas: alternativasEncontradas, respostaCorreta: respostaCorreta, dica: dica, resolucaoTexto: resolucaoTexto, video: video };
        }).filter(q => q !== null);

        renderizarQuestao();
    } catch (error) {
        document.getElementById('jogo-area').innerHTML = `<h2>Erro ao carregar ou processar o simulado.</h2>`;
    }
}

function renderizarQuestao() {
    const area = document.getElementById('jogo-area');
    const contadorTopo = document.getElementById('contador-passos');

    if (indiceAtual >= questoes.length) {
        if (contadorTopo) contadorTopo.innerText = "";
        area.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h2>🎉 Missão Cumprida, ${alunoNomeOriginal}!</h2>
                <p>Você completou o simulado com <strong style="font-size: 24px; color: #4CAF50;">${pontosTotais}</strong> pontos.</p>
                <button class="btn btn-avancar" onclick="limparProgressoEVoltar()" style="text-align:center;">Voltar ao Menu Principal</button>
            </div>`;
        return;
    }

    const q = questoes[indiceAtual];
    const estadoQuestao = respostasPorQuestao[indiceAtual];
    tentativas = estadoQuestao ? estadoQuestao.tentativas : 0;
    tempoInicioQuestao = Date.now();

    if (contadorTopo) {
        contadorTopo.innerText = `📋 Questão ${q.id} de ${questoes.length}`;
    }

    let botoesHtml = "";
    q.alternativas.forEach(alt => {
        const marcado = estadoQuestao && estadoQuestao.letraEscolhida === alt.letra;
        const estadoCor = marcado ? (estadoQuestao.estado === 'acertou' ? '#c8e6c9' : '#ffcdd2') : '';
        const desabilitado = estadoQuestao ? 'disabled' : '';
        botoesHtml += `<button id="btn-${alt.letra}" class="btn btn-opcao" style="background:${estadoCor}" onclick="verificarResposta('${alt.letra}')" ${desabilitado}>${alt.texto}</button>`;
    });

    // Botão para revelar a dica sem errar (só antes de responder e se ainda não foi pedida).
    let dicaBotaoHtml = "";
    if (!estadoQuestao && !dicasUsadas[indiceAtual]) {
        dicaBotaoHtml = `<button id="btn-ver-dica" class="btn btn-dica" onclick="verDica()">💡 Ver Dica (-5 pontos)</button>`;
    }

    const proximaAtiva = indiceAtual < questoes.length - 1 && indiceAtual < indiceMaxAlcancado;
    const anteriorAtivo = indiceAtual > 0;
    const navegacaoHtml = `
        <div class="nav-botoes">
            <button class="btn btn-nav" onclick="voltarQuestao()" ${anteriorAtivo ? '' : 'disabled'}>⬅️ Anterior</button>
            <button class="btn btn-nav" onclick="proximaQuestaoControlada()" ${proximaAtiva ? '' : 'disabled'}>Próxima ➡️</button>
        </div>
    `;

    area.innerHTML = `
        ${q.imagem ? `<img src="${q.imagem}" class="img-enunciado">` : ''}
        <div id="bloco-alternativas">${botoesHtml}</div>
        ${dicaBotaoHtml}
        ${navegacaoHtml}
        <div id="box-dica" class="box box-dica"></div>
        <div id="box-resolucao" class="box box-resolucao"></div>
    `;

    if (estadoQuestao) {
        renderizarResolucaoAnterior(q, estadoQuestao);
    } else if (dicasUsadas[indiceAtual]) {
        mostrarDica(q);
    }
}

function mostrarDica(q) {
    const dicaBox = document.getElementById('box-dica');
    if (!dicaBox) return;
    dicaBox.innerHTML = `💡 <strong>Dica:</strong><br>${q.dica}`;
    dicaBox.style.display = 'block';
}

function verDica() {
    if (dicasUsadas[indiceAtual]) return;

    dicasUsadas[indiceAtual] = true;
    salvarDicasUsadas();

    const btn = document.getElementById('btn-ver-dica');
    if (btn) btn.remove();

    mostrarDica(questoes[indiceAtual]);
}

function salvarDicasUsadas() {
    localStorage.setItem(`${alunoNomeNormalizado}_dicas_${testeId}`, JSON.stringify(dicasUsadas));
}

// Controle do YouTube Player
let ytPlayer = null;

function extrairVideoInfo(url) {
    const idMatch = url.match(/(?:youtube\.com\/embed\/|(?:youtube\.com\/watch\?v=|youtu\.be\/))([^?&]+)/);
    const tMatch = url.match(/[?&]t=(\d+)/);
    return {
        videoId: idMatch ? idMatch[1] : null,
        startTime: tMatch ? parseInt(tMatch[1]) : null
    };
}

function inicializarYouTubePlayer(videoId, startTime) {
    if (ytPlayer) {
        try { ytPlayer.destroy(); } catch (e) { }
        ytPlayer = null;
    }

    // Fallback: API not loaded yet, use plain iframe
    if (!window.YT || !window.YT.Player) {
        const container = document.getElementById('yt-player');
        if (container) {
            const paramStr = startTime ? `?start=${startTime}` : '';
            container.innerHTML = `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}${paramStr}" frameborder="0" allowfullscreen style="margin-top:10px; border-radius:6px;"></iframe>`;
        }
        if (startTime) {
            iniciarContadorDesbloqueio(90);
        } else {
            liberarBotaoAvancar();
        }
        return;
    }

    const playerVars = { rel: 0, modestbranding: 1, controls: 0 };
    if (startTime) playerVars.start = startTime;

    ytPlayer = new YT.Player('yt-player', {
        height: '315',
        width: '100%',
        videoId: videoId,
        playerVars: playerVars,
        events: {
            onStateChange: function (event) {
                if (event.data === YT.PlayerState.ENDED) {
                    liberarBotaoAvancar();
                }
            }
        }
    });

    // t= present → countdown 90s; no t= → block until video ends
    if (startTime) iniciarContadorDesbloqueio(90);
}

function iniciarContadorDesbloqueio(segundosTotal) {
    let restante = segundosTotal;
    const btn = document.getElementById('btn-avancar-questao');

    const intervalo = setInterval(() => {
        restante--;
        const btn = document.getElementById('btn-avancar-questao');
        if (!btn) { clearInterval(intervalo); return; }

        if (restante <= 0) {
            clearInterval(intervalo);
            liberarBotaoAvancar();
        } else {
            const mins = Math.floor(restante / 60);
            const segs = String(restante % 60).padStart(2, '0');
            btn.title = `Aguarde ${mins}:${segs}`;
            btn.textContent = `⏳ Aguarde ${mins}:${segs}`;
        }
    }, 1000);
}

function liberarBotaoAvancar() {
    const btn = document.getElementById('btn-avancar-questao');
    if (btn) {
        btn.disabled = false;
        btn.removeAttribute('title');
        btn.textContent = 'Avançar para a Próxima ➡️';
        btn.onclick = proximaQuestao;
    }
}

function getIndiceMaxRespondido() {
    const indices = Object.keys(respostasPorQuestao).map(key => Number(key));
    if (indices.length === 0) return -1;
    return Math.max(...indices);
}

function salvarRespostasPorQuestao() {
    localStorage.setItem(`${alunoNomeNormalizado}_respostas_${testeId}`, JSON.stringify(respostasPorQuestao));
}

function salvarProgressoAtual() {
    localStorage.setItem(`${alunoNomeNormalizado}_progresso_${testeId}`, indiceAtual);
}

function renderizarVideoReview(url) {
    const { videoId, startTime } = extrairVideoInfo(url);
    if (!videoId) return '';
    const paramStr = `?rel=0&modestbranding=1${startTime ? `&start=${startTime}` : ''}`;
    return `<iframe width="100%" height="315" src="https://www.youtube.com/embed/${videoId}${paramStr}" frameborder="0" allowfullscreen style="margin-top:10px; border-radius:6px;"></iframe>`;
}

function renderizarResolucaoAnterior(q, estadoQuestao) {
    const resBox = document.getElementById('box-resolucao');
    const dicaBox = document.getElementById('box-dica');
    dicaBox.style.display = 'none';

    const corClasse = estadoQuestao.estado === 'acertou' ? 'sucesso-border' : 'erro-border';
    let htmlResolucao = estadoQuestao.estado === 'acertou'
        ? `<h4>🌟 Questão respondida corretamente (${estadoQuestao.tentativas} tentativa${estadoQuestao.tentativas === 1 ? '' : 's'})</h4>`
        : `<h4>⚠️ Questão revisada após erro</h4>`;

    if (q.resolucaoTexto) htmlResolucao += `<p>${q.resolucaoTexto}</p>`;
    if (q.video) htmlResolucao += renderizarVideoReview(q.video);

    resBox.innerHTML = htmlResolucao;
    resBox.className = `box box-resolucao ${corClasse}`;
    resBox.style.display = 'block';
}

function voltarQuestao() {
    if (indiceAtual <= 0) return;
    indiceAtual--;
    salvarProgressoAtual();
    renderizarQuestao();
}

function proximaQuestaoControlada() {
    if (indiceAtual < questoes.length - 1 && indiceAtual < indiceMaxAlcancado) {
        indiceAtual++;
        salvarProgressoAtual();
        renderizarQuestao();
    }
}

function verificarResposta(letraEscolhida) {
    const q = questoes[indiceAtual];
    const resBox = document.getElementById('box-resolucao');

    const { videoId, startTime } = q.video ? extrairVideoInfo(q.video) : {};
    const shouldBlock = q.video && !startTime;

    if (letraEscolhida === q.respostaCorreta) {
        let pontosGanhos = (tentativas === 0) ? 10 : 5;
        if (dicasUsadas[indiceAtual]) pontosGanhos = Math.max(0, pontosGanhos - 5); // dica pedida: -5 pontos
        document.getElementById(`btn-${letraEscolhida}`).style.background = '#c8e6c9';

        pontosTotais += pontosGanhos;
        localStorage.setItem(`${alunoNomeNormalizado}_pontos_${testeId}`, pontosTotais);
        document.getElementById('placar').innerText = pontosTotais;

        document.querySelectorAll('.btn-opcao').forEach(btn => btn.disabled = true);
        document.getElementById('box-dica').style.display = 'none';

        const tempoGastoSegundos = Math.round((Date.now() - tempoInicioQuestao) / 1000);
        salvarStatusNoGoogleSheets(q.id, tentativas + 1, tempoGastoSegundos);

        let htmlResolucao = `<h4>🌟 Excelente! Você acertou e ganhou +${pontosGanhos} pontos!</h4>`;
        if (q.resolucaoTexto) htmlResolucao += `<p>${q.resolucaoTexto}</p>`;
        if (q.video) {
            htmlResolucao += `<div id="yt-player" style="margin-top:10px; border-radius:6px; overflow:hidden;"></div>`;
            if (shouldBlock) htmlResolucao += `<p style="font-size:13px; color:#e65100; margin:8px 0 0; text-align:center;">📺 Assista ao vídeo completo para poder avançar</p>`;
        }
        htmlResolucao += `<button id="btn-avancar-questao" class="btn btn-avancar" disabled>Avançar para a Próxima ➡️</button>`;

        resBox.innerHTML = htmlResolucao;
        resBox.className = "box box-resolucao sucesso-border";
        resBox.style.display = 'block';

        registrarRespostaQuestao(q, 'acertou', letraEscolhida);

        if (q.video) inicializarYouTubePlayer(videoId, startTime);
        else liberarBotaoAvancar();
    } else {
        tentativas++;
        document.getElementById(`btn-${letraEscolhida}`).disabled = true;
        document.getElementById(`btn-${letraEscolhida}`).style.background = '#ffcdd2';

        if (tentativas === 1) {
            const dicaBox = document.getElementById('box-dica');
            dicaBox.innerHTML = `💡 <strong>Dica:</strong><br>${q.dica}`;
            dicaBox.style.display = 'block';
        } else {
            document.querySelectorAll('.btn-opcao').forEach(btn => btn.disabled = true);
            document.getElementById('box-dica').style.display = 'none';

            const tempoGastoSegundos = Math.round((Date.now() - tempoInicioQuestao) / 1000);
            salvarStatusNoGoogleSheets(q.id, tentativas, tempoGastoSegundos);

            let htmlResolucao = `<h4>⚠️ Tentativas esgotadas! Vamos aprender?</h4>`;
            if (q.resolucaoTexto) htmlResolucao += `<p>${q.resolucaoTexto}</p>`;
            if (q.video) {
                htmlResolucao += `<div id="yt-player" style="margin-top:10px; border-radius:6px; overflow:hidden;"></div>`;
                if (shouldBlock) htmlResolucao += `<p style="font-size:13px; color:#e65100; margin:8px 0 0; text-align:center;">📺 Assista ao vídeo completo para poder avançar</p>`;
            }
            htmlResolucao += `<button id="btn-avancar-questao" class="btn btn-avancar" disabled>Ir para a Próxima Questão</button>`;

            resBox.innerHTML = htmlResolucao;
            resBox.className = "box box-resolucao erro-border";
            resBox.style.display = 'block';

            registrarRespostaQuestao(q, 'errou', letraEscolhida);

            if (q.video) inicializarYouTubePlayer(videoId, startTime);
            else liberarBotaoAvancar();
        }
    }
}

function registrarRespostaQuestao(q, estado, letraEscolhida) {
    respostasPorQuestao[indiceAtual] = {
        estado: estado,
        tentativas: tentativas + 1,
        letraEscolhida: letraEscolhida,
        atualizadoEm: new Date().toISOString()
    };
    indiceMaxRespondido = Math.max(indiceMaxRespondido, indiceAtual);
    salvarRespostasPorQuestao();
}

async function salvarStatusNoGoogleSheets(questaoId, totalTentativas, segundos) {
    const GOOGLE_FORM_URL = "https://docs.google.com/forms/d/e/1FAIpQLSc7ibzbk6aPBl8Yh6uG66ag7dttJ6zxUZwF6AXixSiPMFYJBQ/formResponse";

    const formData = new URLSearchParams();
    formData.append("entry.573764493", alunoNomeOriginal);
    formData.append("entry.561164763", testeId);
    formData.append("entry.1414238788", questaoId);
    formData.append("entry.742561518", totalTentativas);
    formData.append("entry.223264347", segundos);

    try {
        await fetch(GOOGLE_FORM_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString()
        });
    } catch (e) {
        console.error("Erro ao salvar progresso no Google Sheets:", e);
    }
}

function proximaQuestao() {
    if (indiceAtual < questoes.length - 1) {
        indiceAtual++;
    } else {
        indiceAtual = questoes.length;
    }
    // Avança a fronteira: este é o único caminho que passa pela liberação (vídeo/timer).
    indiceMaxAlcancado = Math.max(indiceMaxAlcancado, indiceAtual);
    salvarProgressoAtual();
    renderizarQuestao();
}

function voltarParaHome() {
    window.location.href = "?";
}

function limparProgressoEVoltar() {
    localStorage.removeItem(`${alunoNomeNormalizado}_pontos_${testeId}`);
    localStorage.removeItem(`${alunoNomeNormalizado}_progresso_${testeId}`);
    localStorage.removeItem(`${alunoNomeNormalizado}_dicas_${testeId}`);
    window.location.href = "?";
}

function fazerLogout() {
    localStorage.removeItem("atual_aluno_nome_original");
    localStorage.removeItem("atual_aluno_nome_normalizado");
    window.location.href = "?";
}

window.onload = inicializar;
