let questoes = [];
let indiceAtual = 0;
let tentativas = 0;
let pontosTotais = 0;
let testeId = "";

const urlParams = new URLSearchParams(window.location.search);
testeId = urlParams.get('teste');

async function inicializar() {
    if (!testeId) {
        carregarMenuPrincipal();
    } else {
        carregarTesteEspecifico(testeId);
    }
}

// Carrega a Home lendo o testes.md
async function carregarMenuPrincipal() {
    try {
        const response = await fetch('testes.md');
        const texto = await response.text();
        document.getElementById('container-home').style.display = 'block';
        document.getElementById('container-jogo').style.display = 'none';

        const lines = texto.split('\n');
        let htmlMenu = "<h1>🎯 Seus Desafios Disponíveis:</h1><ul class='lista-testes'>";

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
        document.getElementById('container-home').innerHTML = htmlMenu;
    } catch (e) {
        document.getElementById('container-home').innerHTML = "<h2>Erro ao carregar menu testes.md</h2>";
    }
}

// Carrega as questões do arquivo MD
async function carregarTesteEspecifico(id) {
    document.getElementById('container-home').style.display = 'none';
    document.getElementById('container-jogo').style.display = 'block';

    try {
        const response = await fetch(`simulados/${id}.md`);
        if (!response.ok) throw new Error();
        const textoMarkdown = await response.text();

        pontosTotais = parseInt(localStorage.getItem(`pontos_${id}`)) || 0;
        indiceAtual = parseInt(localStorage.getItem(`progresso_${id}`)) || 0;
        document.getElementById('placar').innerText = pontosTotais;

        const blocos = textoMarkdown.split('---');

        questoes = blocos.map((bloco, index) => {
            // 1. Captura a Imagem
            const imgMatch = bloco.match(new RegExp('!\\[.*?\\]\\((.*?)\\)'));
            const imagem = imgMatch ? imgMatch[1].trim() : "";

            // 2. Captura o Gabarito (Tolerante a maiúsculas/minúsculas)
            const gabaritoMatch = bloco.match(new RegExp('gabarito:\\s*([A-E])', 'i'));
            const respostaCorreta = gabaritoMatch ? gabaritoMatch[1].toUpperCase() : "A";

            // 3. Captura o Vídeo (Suporta v[ií]deo: com ou sem acento)
            const videoMatch = bloco.match(new RegExp('v[ií]deo:\\s*(https?://[^\\s\\n]+)', 'i'));
            const video = videoMatch ? videoMatch[1].trim() : "";

            // 4. Captura a Dica Multilinha usando lazy match entre palavras-chave
            const dicaMatch = bloco.match(new RegExp('dica:\\s*(.*?)(?=\\n\\s*(explica[cç]ã[oō]|v[ií]deo:|$))', 'is'));
            const dica = dicaMatch ? dicaMatch[1].trim().replace(/\n/g, '<br>') : "Preste atenção nos detalhes.";

            // 5. Captura a Explicação Multilinha
            const explMatch = bloco.match(new RegExp('explica[cç]ã[oō]:\\s*(.*?)(?=\\n\\s*(v[ií]deo:|$))', 'is'));
            const resolucaoTexto = explMatch ? explMatch[1].trim().replace(/\n/g, '<br>') : "";

            // 6. Captura as Alternativas
            const linhas = bloco.split('\n');
            let alternativasEncontradas = [];
            let letrasOpcoes = ["A", "B", "C", "D", "E"];
            let contadorAlt = 0;

            linhas.forEach(linha => {
                const linhaLimpa = linha.trim();
                if (linhaLimpa.startsWith('-')) {
                    let textoAlternativa = linhaLimpa.replace('-', '').trim();
                    let letra = letrasOpcoes[contadorAlt] || "A";

                    if (!textoAlternativa.startsWith(letra)) {
                        textoAlternativa = `${letra}) ${textoAlternativa}`;
                    }
                    alternativasEncontradas.push({ letra: letra, texto: textoAlternativa });
                    contadorAlt++;
                }
            });

            if (alternativasEncontradas.length === 0 && !imagem) return null;

            return {
                id: index + 1,
                imagem: imagem,
                alternativas: alternativasEncontradas,
                respostaCorreta: respostaCorreta,
                dica: dica,
                resolucaoTexto: resolucaoTexto,
                video: video
            };
        }).filter(q => q !== null);

        renderizarQuestao();
    } catch (error) {
        document.getElementById('jogo-area').innerHTML = `<h2>Erro ao carregar ou processar o simulado Markdown.</h2>`;
    }
}

function renderizarQuestao() {
    const area = document.getElementById('jogo-area');
    if (indiceAtual >= questoes.length) {
        area.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h2>🎉 Missão Cumprida! Você concluiu o simulado!</h2>
                <p>Sua pontuação final: <strong style="font-size: 24px; color: #4CAF50;">${pontosTotais}</strong> pontos.</p>
                <button class="btn btn-avancar" onclick="limparProgressoEVoltar()" style="text-align:center;">Voltar ao Menu Principal</button>
            </div>`;
        return;
    }

    const q = questoes[indiceAtual];
    tentativas = 0;

    let botoesHtml = "";
    q.alternativas.forEach(alt => {
        botoesHtml += `<button id="btn-${alt.letra}" class="btn btn-opcao" onclick="verificarResposta('${alt.letra}')">${alt.texto}</button>`;
    });

    area.innerHTML = `
        <div class="info-questao">Questão ${q.id} de ${questoes.length}</div>
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
        localStorage.setItem(`pontos_${testeId}`, pontosTotais);
        document.getElementById('placar').innerText = pontosTotais;

        document.querySelectorAll('.btn-opcao').forEach(btn => btn.disabled = true);
        document.getElementById('box-dica').style.display = 'none';

        // Monta o cabeçalho de acerto
        let htmlResolucao = `<h4>🌟 Excelente! Você acertou e ganhou +${pontosGanhos} pontos!</h4>`;

        // Só injeta o texto se ele realmente existir no MD
        if (q.resolucaoTexto) {
            htmlResolucao += `<p>${q.resolucaoTexto}</p>`;
        }
        // Injeta o player do YouTube se houver link cadastrado
        if (q.video) {
            htmlResolucao += `<iframe width="100%" height="315" src="${q.video}" frameborder="0" allowfullscreen style="margin-top:10px; border-radius:6px;"></iframe>`;
        }
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

            let htmlResolucao = `<h4>⚠️ Tentativas esgotadas! Vamos aprender?</h4>`;

            if (q.resolucaoTexto) {
                htmlResolucao += `<p>${q.resolucaoTexto}</p>`;
            }
            if (q.video) {
                htmlResolucao += `<iframe width="100%" height="315" src="${q.video}" frameborder="0" allowfullscreen style="margin-top:10px; border-radius:6px;"></iframe>`;
            }
            htmlResolucao += `<button class="btn btn-avancar" onclick="proximaQuestao()">Ir para a Próxima Questão</button>`;

            resBox.innerHTML = htmlResolucao;
            resBox.className = "box box-resolucao erro-border";
            resBox.style.display = 'block';
        }
    }
}

function proximaQuestao() {
    indiceAtual++;
    localStorage.setItem(`progresso_${testeId}`, indiceAtual);
    renderizarQuestao();
}

function limparProgressoEVoltar() {
    localStorage.removeItem(`pontos_${testeId}`);
    localStorage.removeItem(`progresso_${testeId}`);
    window.location.href = "?";
}

window.onload = inicializar;