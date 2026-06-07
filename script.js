let questoes = [];
let indiceAtual = 0;
let tentativas = 0;
let pontosTotais = 0;
let testeId = "";

// Variáveis de Controle do Aluno e Tempo
let alunoNomeOriginal = "";
let alunoNomeNormalizado = "";
let tempoInicioQuestao = 0;

// Configurações das URLs do Dontpad (Substitua pelos seus sufixos exclusivos)
const SUFIXO_INDICE_GERAL = "nananaewe_simulado_indice_geral_2026";
const URL_DONTPAD_INDICE = `https://api.dontpad.com/${SUFIXO_INDICE_GERAL}.txt`;

const urlParams = new URLSearchParams(window.location.search);
testeId = urlParams.get('teste');

async function inicializar() {
    // Atualiza o link do índice geral no rodapé da página inicial
    document.getElementById('link-indice-externo').href = `https://dontpad.com/${SUFIXO_INDICE_GERAL}`;

    // Recupera se já havia um aluno logado nesta máquina
    alunoNomeOriginal = localStorage.getItem("atual_aluno_nome_original") || "";
    alunoNomeNormalizado = localStorage.getItem("atual_aluno_nome_normalizado") || "";

    if (!alunoNomeNormalizado) {
        // Cenário 1: Se não sabe quem é o aluno, obriga a passar pela tela de login
        document.getElementById('container-login').style.display = 'block';
        document.getElementById('container-home').style.display = 'none';
        document.getElementById('container-jogo').style.display = 'none';
    } else {
        // Cenário 2: Aluno reconhecido. Vai para o menu ou direto para o teste pendente
        if (!testeId) {
            carregarMenuPrincipal();
        } else {
            carregarTesteEspecifico(testeId);
        }
    }
}

// Trata, higieniza e padroniza o nome do aluno
function entrarNaPlataforma() {
    const input = document.getElementById('input-aluno-nome').value.trim();
    if (!input) {
        alert("Por favor, digite um nome válido!");
        return;
    }

    // 1. Capitalização (Força primeira letra de cada palavra maiúscula, resto minúscula)
    alunoNomeOriginal = input.split(/\s+/).map(palavra => {
        return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
    }).join(' ');

    // 2. Normalização para URL Dontpad (remove acentos, troca espaços por sublinhado, tudo minúsculo)
    alunoNomeNormalizado = alunoNomeOriginal
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove acentos acentuados
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "") // Remove caracteres especiais extras
        .replace(/\s+/g, "_");       // Troca espaços por _

    // Salva a sessão do aluno ativo no navegador
    localStorage.setItem("atual_aluno_nome_original", alunoNomeOriginal);
    localStorage.setItem("atual_aluno_nome_normalizado", alunoNomeNormalizado);

    // Registra este aluno de forma assíncrona na lista central do Dontpad
    registrarAlunoNoIndiceGeral(alunoNomeOriginal, alunoNomeNormalizado);

    document.getElementById('container-login').style.display = 'none';

    if (!testeId) {
        carregarMenuPrincipal();
    } else {
        carregarTesteEspecifico(testeId);
    }
}

// Registra o link do Dontpad do aluno no arquivo índice principal (sem duplicar)
async function registrarAlunoNoIndiceGeral(nomeCompleto, nomeUrl) {
    const linkAluno = `dontpad.com/simulado_aluno_${nomeUrl}`;
    const linhaRegistro = `${nomeCompleto} -> https://${linkAluno}`;

    try {
        const res = await fetch(URL_DONTPAD_INDICE);
        const textoIndice = await res.text();

        // Verifica se o aluno já foi listado antes para não poluir o arquivo
        if (!textoIndice.includes(linkAluno)) {
            const novoIndice = textoIndice.trim() + "\n" + linhaRegistro;
            await fetch(URL_DONTPAD_INDICE, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: "text=" + encodeURIComponent(novoIndice)
            });
        }
    } catch (err) {
        console.error("Falha ao atualizar o índice central:", err);
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

        // 🧠 CHAVE EXCLUSIVA POR ALUNO: Vincula o progresso do LocalStorage ao ID do aluno ativo!
        pontosTotais = parseInt(localStorage.getItem(`${alunoNomeNormalizado}_pontos_${id}`)) || 0;
        indiceAtual = parseInt(localStorage.getItem(`${alunoNomeNormalizado}_progresso_${id}`)) || 0;
        document.getElementById('placar').innerText = pontosTotais;

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
    tentativas = 0;
    tempoInicioQuestao = Date.now();

    if (contadorTopo) {
        contadorTopo.innerText = `📋 Questão ${q.id} de ${questoes.length}`;
    }

    let botoesHtml = "";
    q.alternativas.forEach(alt => {
        botoesHtml += `<button id="btn-${alt.letra}" class="btn btn-opcao" onclick="verificarResposta('${alt.letra}')">${alt.texto}</button>`;
    });

    area.innerHTML = `
        ${q.imagem ? `<img src="${q.imagem}" class="img-enunciado">` : ''}
        <div id="bloco-alternativas">${botoesHtml}</div>
        <div id="box-dica" class="box box-dica"></div>
        <div id="box-resolucao" class="box box-resolucao"></div>
    `;
}

function verificarResposta(letraEscolhida) {
    const q = questoes[indiceAtual];
    const resBox = document.getElementById('box-resolucao');

    if (letraEscolhida === q.respostaCorreta) {
        let pontosGanhos = (tentativas === 0) ? 10 : 5;
        document.getElementById(`btn-${letraEscolhida}`).style.background = '#c8e6c9';

        pontosTotais += pontosGanhos;
        localStorage.setItem(`${alunoNomeNormalizado}_pontos_${testeId}`, pontosTotais);
        document.getElementById('placar').innerText = pontosTotais;

        document.querySelectorAll('.btn-opcao').forEach(btn => btn.disabled = true);
        document.getElementById('box-dica').style.display = 'none';

        // Log de tempo e envio assíncrono para a URL exclusiva do aluno no Dontpad
        const tempoGastoSegundos = Math.round((Date.now() - tempoInicioQuestao) / 1000);
        salvarNoDontpadDoAluno(q.id, tentativas + 1, tempoGastoSegundos);

        let htmlResolucao = `<h4>🌟 Excelente! Você acertou e ganhou +${pontosGanhos} pontos!</h4>`;
        if (q.resolucaoTexto) htmlResolucao += `<p>${q.resolucaoTexto}</p>`;
        if (q.video) htmlResolucao += `<iframe width="100%" height="315" src="${q.video}" frameborder="0" allowfullscreen style="margin-top:10px; border-radius:6px;"></iframe>`;
        htmlResolucao += `<button class="btn btn-avancar" onclick="proximaQuestao()">Avançar para a Próxima ➡️</button>`;

        resBox.innerHTML = htmlResolucao;
        resBox.className = "box box-resolucao sucesso-border";
        resBox.style.display = 'block';
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
            salvarNoDontpadDoAluno(q.id, tentativas, tempoGastoSegundos);

            let htmlResolucao = `<h4>⚠️ Tentativas esgotadas! Vamos aprender?</h4>`;
            if (q.resolucaoTexto) htmlResolucao += `<p>${q.resolucaoTexto}</p>`;
            if (q.video) htmlResolucao += `<iframe width="100%" height="315" src="${q.video}" frameborder="0" allowfullscreen style="margin-top:10px; border-radius:6px;"></iframe>`;
            htmlResolucao += `<button class="btn btn-avancar" onclick="proximaQuestao()">Ir para a Próxima Questão</button>`;

            resBox.innerHTML = htmlResolucao;
            resBox.className = "box box-resolucao erro-border";
            resBox.style.display = 'block';
        }
    }
}

async function salvarNoDontpadDoAluno(questaoId, totalTentativas, segundos) {
    const URL_ALUNO = `https://api.dontpad.com/simulado_aluno_${alunoNomeNormalizado}.txt`;
    const novaLinha = `[${new Date().toLocaleString()}] Simulado: ${testeId} | Questão: ${questaoId} | Tentativas: ${totalTentativas} | Tempo: ${segundos}s\n`;

    try {
        const res = await fetch(URL_ALUNO);
        const historicoAntigo = await res.text();
        const historicoAtualizado = historicoAntigo + novaLinha;

        await fetch(URL_ALUNO, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: "text=" + encodeURIComponent(historicoAtualizado)
        });
    } catch (e) {
        console.error("Erro ao sincronizar Dontpad do aluno.");
    }
}

function proximaQuestao() {
    indiceAtual++;
    localStorage.setItem(`${alunoNomeNormalizado}_progresso_${testeId}`, indiceAtual);
    renderizarQuestao();
}

function voltarParaHome() {
    window.location.href = "?";
}

function limparProgressoEVoltar() {
    localStorage.removeItem(`${alunoNomeNormalizado}_pontos_${testeId}`);
    localStorage.removeItem(`${alunoNomeNormalizado}_progresso_${testeId}`);
    window.location.href = "?";
}

function fazerLogout() {
    localStorage.removeItem("atual_aluno_nome_original");
    localStorage.removeItem("atual_aluno_nome_normalizado");
    window.location.href = "?";
}

window.onload = inicializar;