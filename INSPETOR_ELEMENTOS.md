# Instrucao: Adicionar Inspetor de Elementos

## O que e isso?

Ferramenta JavaScript que permite inspecionar elementos HTML de qualquer pagina web com clique direito. Mostra informacoes completas sobre o elemento e permite copiar tudo para comunicar com Claude Code.

---

## Como solicitar ao Claude Code

### Comando basico:

```
Adicione o inspetor de elementos neste projeto conforme INSTRUCOES_PROJETOS/INSPETOR_ELEMENTOS.md
```

### Exemplo com caminho especifico:

```
Adicione o inspetor de elementos no projeto C:\Users\alex\Documents\MEU_PROJETO
Salve em public/js/inspetor.js e adicione no index.html
```

---

## O que o Inspetor captura

### Contexto de navegacao:
- **Aba ativa** - Tab principal (Dashboard, Financeiro, etc.)
- **Sub-aba ativa** - Navegacao secundaria (Contas a Pagar, etc.)
- **Secao** - Titulo do painel ou card

### Informacoes do elemento:
- Tag, ID, Classes
- Dimensoes (largura x altura)
- Estilos (background, borda, radius, padding)
- Tipografia (fonte, tamanho, peso)
- Hierarquia (caminho no DOM)
- Eventos JS atribuidos

### Elementos filhos (se container):
- Todos os inputs, selects, buttons, textareas, links
- Valores atuais e placeholders
- Opcoes de selects
- Texto de botoes
- Estilos individuais

---

## Como adicionar ao projeto

### 1. Criar arquivo js/inspetor.js

### 2. Adicionar script no HTML principal (antes do </body>):

```html
<script src="js/inspetor.js"></script>
```

---

## Como usar

1. Clique no botao flutuante "Inspetor" (canto inferior direito)
2. Passe o mouse sobre elementos para destacar
3. Clique direito para ver informacoes completas
4. Clique "COPIAR TUDO" para copiar em formato de paragrafo unico

---

## Formato da copia

Exemplo de output copiado:

```
Aba: Financeiro | Sub-aba: Contas a Pagar | Secao: Contas a Pagar | Container: div#filtros-contas.filtros-contas (850px x 60px, bg: rgb(255, 255, 255), radius: 12px, padding: 16px) | Filhos: [1] select#filtro-status-pagar.filtro-select (120px x 36px, bg: rgb(255, 255, 255), borda: 1px solid rgb(226, 232, 240), radius: 8px | Valor: Todos | Opcoes: Todos, Pendente, Pago, Vencido) [2] input#filtro-busca-pagar.filtro-input (200px x 36px, bg: rgb(255, 255, 255), borda: 1px solid rgb(226, 232, 240), radius: 8px | Placeholder: Buscar...)
```

---

## Codigo do Inspetor

Salvar como `js/inspetor.js`:

```javascript
/**
 * Modo Inspetor de Elementos
 * Permite inspecionar elementos da pagina com botao direito
 * Mostra informacoes completas e permite copiar seletores
 */

(function() {
    'use strict';

    let inspetorAtivo = false;
    let elementoDestacado = null;
    let popup = null;
    let overlay = null;
    let btnInspetor = null;

    // Cores do tema
    const CORES = {
        destaque: '#3b82f6',
        fundo: '#1e293b',
        texto: '#f8fafc',
        borda: '#3b82f6',
        copiar: '#22c55e'
    };

    // Criar botao flutuante
    function criarBotaoInspetor() {
        btnInspetor = document.createElement('button');
        btnInspetor.id = 'btn-inspetor';
        btnInspetor.innerHTML = '&#128269; Inspetor';
        btnInspetor.title = 'Ativar/Desativar Modo Inspetor';
        btnInspetor.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 99999;
            padding: 10px 16px;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4);
            transition: all 0.3s ease;
            font-family: Inter, system-ui, sans-serif;
        `;
        btnInspetor.addEventListener('click', toggleInspetor);
        btnInspetor.addEventListener('mouseenter', () => {
            btnInspetor.style.transform = 'scale(1.05)';
        });
        btnInspetor.addEventListener('mouseleave', () => {
            btnInspetor.style.transform = 'scale(1)';
        });
        document.body.appendChild(btnInspetor);
    }

    // Criar overlay de destaque
    function criarOverlay() {
        overlay = document.createElement('div');
        overlay.id = 'inspetor-overlay';
        overlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 99997;
            border: 2px solid ${CORES.destaque};
            background: rgba(59, 130, 246, 0.15);
            display: none;
        `;
        document.body.appendChild(overlay);
    }

    // Criar popup de informacoes
    function criarPopup() {
        popup = document.createElement('div');
        popup.id = 'inspetor-popup';
        popup.style.cssText = `
            position: fixed;
            z-index: 99998;
            background: ${CORES.fundo};
            color: ${CORES.texto};
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            max-width: 420px;
            min-width: 320px;
            font-family: Inter, system-ui, sans-serif;
            font-size: 13px;
            display: none;
            overflow: hidden;
        `;
        document.body.appendChild(popup);
    }

    // Toggle do inspetor
    function toggleInspetor() {
        inspetorAtivo = !inspetorAtivo;

        if (inspetorAtivo) {
            btnInspetor.innerHTML = '&#10006; Fechar Inspetor';
            btnInspetor.style.background = 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)';
            btnInspetor.style.boxShadow = '0 4px 15px rgba(239, 68, 68, 0.4)';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('contextmenu', onRightClick);
            document.addEventListener('click', fecharPopup);
            showToast('Modo Inspetor ATIVADO - Clique direito para inspecionar');
        } else {
            btnInspetor.innerHTML = '&#128269; Inspetor';
            btnInspetor.style.background = 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';
            btnInspetor.style.boxShadow = '0 4px 15px rgba(59, 130, 246, 0.4)';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('contextmenu', onRightClick);
            document.removeEventListener('click', fecharPopup);
            overlay.style.display = 'none';
            popup.style.display = 'none';
            showToast('Modo Inspetor DESATIVADO');
        }
    }

    // Mouse move - destacar elemento em tempo real
    function onMouseMove(e) {
        if (!inspetorAtivo) return;

        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || el === btnInspetor || el === popup || el === overlay || popup.contains(el)) return;

        elementoDestacado = el;
        const rect = el.getBoundingClientRect();

        overlay.style.display = 'block';
        overlay.style.top = rect.top + 'px';
        overlay.style.left = rect.left + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
    }

    // Right click - mostrar popup
    function onRightClick(e) {
        if (!inspetorAtivo) return;
        if (e.target === btnInspetor || e.target === popup || popup.contains(e.target)) return;

        e.preventDefault();
        elementoDestacado = e.target;

        const info = getElementInfo(elementoDestacado);
        renderPopup(info, e.clientX, e.clientY);
    }

    // Fechar popup ao clicar fora
    function fecharPopup(e) {
        if (popup && popup.style.display === 'block') {
            if (!popup.contains(e.target)) {
                popup.style.display = 'none';
            }
        }
    }

    // Detectar aba principal ativa
    function detectarAbaAtiva() {
        const seletores = [
            '.nav-tab.active',
            '.tab.active',
            '.nav-link.active',
            '[data-tab].active',
            '.tabs button.active',
            '.tab-btn.active',
            'nav button[style*="background"]',
            '.nav button.active'
        ];

        for (const sel of seletores) {
            const el = document.querySelector(sel);
            if (el && el.textContent) {
                return el.textContent.trim().split('\n')[0].trim();
            }
        }

        const navBtns = document.querySelectorAll('nav button, .tabs button, .nav-tabs button');
        for (const btn of navBtns) {
            const bg = window.getComputedStyle(btn).backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent' && bg !== 'rgb(255, 255, 255)') {
                return btn.textContent.trim().split('\n')[0].trim();
            }
        }

        return '-';
    }

    // Detectar sub-aba ativa
    function detectarSubAbaAtiva(el) {
        const botoesAcao = ['buscar', 'limpar', 'salvar', 'cancelar', 'fechar', 'adicionar', 'novo', 'nova', 'importar', 'exportar', 'excluir', 'deletar', 'editar', 'selecionar'];

        const section = document.querySelector('section.active, section:not([style*="display: none"])');

        if (section) {
            const actionBtns = section.querySelectorAll('.action-buttons button, .sub-tabs button, .tab-buttons button');

            for (const btn of actionBtns) {
                const texto = btn.textContent.trim().toLowerCase();
                if (botoesAcao.some(acao => texto.includes(acao))) continue;

                const bg = window.getComputedStyle(btn).backgroundColor;
                if (bg && (bg.includes('249') || bg.includes('234, 88') || bg.includes('251, 146'))) {
                    return btn.textContent.trim();
                }
            }
        }

        const allBtns = document.querySelectorAll('.action-buttons button');
        for (const btn of allBtns) {
            const texto = btn.textContent.trim().toLowerCase();
            if (botoesAcao.some(acao => texto.includes(acao))) continue;

            const bg = window.getComputedStyle(btn).backgroundColor;
            if (bg && (bg.includes('249') || bg.includes('234, 88') || bg.includes('251, 146'))) {
                return btn.textContent.trim();
            }
        }

        return '-';
    }

    // Capturar elementos filhos interativos
    function capturarFilhos(el) {
        const filhos = [];
        const elementosInterativos = el.querySelectorAll('select, input, button, textarea, a');

        let contador = 1;
        elementosInterativos.forEach(filho => {
            const computed = window.getComputedStyle(filho);
            const rect = filho.getBoundingClientRect();
            const tag = filho.tagName.toLowerCase();

            let info = {
                num: contador++,
                tag: tag,
                id: filho.id || '-',
                classes: filho.classList.length > 0 ? Array.from(filho.classList).join('.') : '-',
                largura: Math.round(rect.width) + 'px',
                altura: Math.round(rect.height) + 'px',
                background: computed.backgroundColor,
                borda: computed.border,
                radius: computed.borderRadius,
                fonte: computed.fontFamily.split(',')[0].replace(/"/g, '') + ' ' + computed.fontSize,
                corTexto: computed.color
            };

            if (tag === 'select') {
                info.valor = filho.options[filho.selectedIndex]?.text || '-';
                info.opcoes = Array.from(filho.options).map(o => o.text).join(', ');
            }
            else if (tag === 'input' || tag === 'textarea') {
                info.tipo = filho.type || 'text';
                info.valor = filho.value || '-';
                info.placeholder = filho.placeholder || '-';
            }
            else if (tag === 'button' || tag === 'a') {
                info.texto = filho.textContent.trim().substring(0, 30);
            }

            filhos.push(info);
        });

        return filhos;
    }

    // Formatar filhos para texto
    function formatarFilhos(filhos) {
        if (filhos.length === 0) return '';

        return ' | Filhos: ' + filhos.map(f => {
            let str = `[${f.num}] ${f.tag}`;
            if (f.id !== '-') str += '#' + f.id;
            if (f.classes !== '-') str += '.' + f.classes;
            str += ` (${f.largura}x${f.altura}, bg: ${f.background}, borda: ${f.borda}, radius: ${f.radius}`;

            if (f.tag === 'select') {
                str += ` | Valor: ${f.valor} | Opcoes: ${f.opcoes}`;
            } else if (f.tag === 'input' || f.tag === 'textarea') {
                if (f.valor && f.valor !== '-') str += ` | Valor: ${f.valor}`;
                if (f.placeholder && f.placeholder !== '-') str += ` | Placeholder: ${f.placeholder}`;
            } else if (f.tag === 'button' || f.tag === 'a') {
                str += ` | Texto: ${f.texto}`;
            }

            str += ')';
            return str;
        }).join(' ');
    }

    // Detectar titulo da secao mais proxima
    function detectarTituloSecao(el) {
        let parent = el;
        while (parent && parent !== document.body) {
            const heading = parent.querySelector('h1, h2, h3, h4, .title, .panel-header, .card-header');
            if (heading && heading.textContent) {
                const texto = heading.textContent.trim().split('\n')[0].trim();
                if (texto && texto.length < 50) {
                    return texto;
                }
            }
            parent = parent.parentElement;
        }
        return '-';
    }

    // Obter informacoes do elemento
    function getElementInfo(el) {
        const computed = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        let seletor = el.tagName.toLowerCase();
        if (el.id) seletor += '#' + el.id;
        if (el.classList.length > 0) {
            seletor += '.' + Array.from(el.classList).join('.');
        }

        let hierarquia = [];
        let parent = el;
        while (parent && parent !== document.body && hierarquia.length < 4) {
            let nome = parent.tagName.toLowerCase();
            if (parent.id) nome += '#' + parent.id;
            else if (parent.classList.length > 0) nome += '.' + parent.classList[0];
            hierarquia.unshift(nome);
            parent = parent.parentElement;
        }

        const eventosComuns = ['onclick', 'onchange', 'oninput', 'onsubmit', 'onmouseover'];
        const eventos = eventosComuns.filter(ev => el[ev] || el.getAttribute(ev));

        const abaAtiva = detectarAbaAtiva();
        const subAbaAtiva = detectarSubAbaAtiva(el);
        const tituloSecao = detectarTituloSecao(el);
        const filhos = capturarFilhos(el);

        return {
            abaAtiva: abaAtiva,
            subAbaAtiva: subAbaAtiva,
            tituloSecao: tituloSecao,
            tag: el.tagName.toLowerCase(),
            id: el.id || '-',
            classes: el.classList.length > 0 ? Array.from(el.classList).join(' ') : '-',
            seletor: seletor,
            largura: Math.round(rect.width) + 'px',
            altura: Math.round(rect.height) + 'px',
            padding: computed.padding,
            margin: computed.margin,
            background: computed.backgroundColor,
            corTexto: computed.color,
            borda: computed.border !== 'none' ? computed.border : '-',
            borderRadius: computed.borderRadius,
            fonte: computed.fontFamily.split(',')[0].replace(/"/g, ''),
            tamanhoFonte: computed.fontSize,
            pesoFonte: computed.fontWeight,
            hierarquia: hierarquia.join(' > '),
            eventos: eventos.length > 0 ? eventos.map(e => e.replace('on', '')).join(', ') : '-',
            textoInterno: el.innerText ? el.innerText.substring(0, 50) + (el.innerText.length > 50 ? '...' : '') : '-',
            filhos: filhos
        };
    }

    // Renderizar popup
    function renderPopup(info, x, y) {
        popup.innerHTML = `
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 12px 16px; font-weight: 600; display: flex; justify-content: space-between; align-items: center;">
                <span>&#128269; Inspetor de Elementos</span>
                <button onclick="document.getElementById('inspetor-popup').style.display='none'" style="background: rgba(255,255,255,0.2); border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 14px;">&#10006;</button>
            </div>
            <div style="padding: 16px; max-height: 400px; overflow-y: auto;">
                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155; background: #0f172a; padding: 10px; border-radius: 8px;">
                    <div style="color: #fbbf24; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Contexto</div>
                    <div style="display: grid; grid-template-columns: 70px 1fr; gap: 4px; font-size: 12px;">
                        <span style="color: #94a3b8;">Aba:</span><span style="color: #22d3ee;">${info.abaAtiva}</span>
                        <span style="color: #94a3b8;">Sub-aba:</span><span style="color: #a78bfa;">${info.subAbaAtiva}</span>
                        <span style="color: #94a3b8;">Secao:</span><span style="color: #4ade80;">${info.tituloSecao}</span>
                    </div>
                </div>

                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Estrutura</div>
                    <div style="display: grid; grid-template-columns: 80px 1fr; gap: 6px;">
                        <span style="color: #94a3b8;">Tag:</span><span style="color: #60a5fa;">&lt;${info.tag}&gt;</span>
                        <span style="color: #94a3b8;">ID:</span><span style="color: #fbbf24;">${info.id}</span>
                        <span style="color: #94a3b8;">Classes:</span><span style="color: #34d399; word-break: break-all;">${info.classes}</span>
                    </div>
                </div>

                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Seletor CSS</div>
                    <code style="display: block; background: #0f172a; padding: 8px 12px; border-radius: 6px; font-size: 12px; color: #e879f9; word-break: break-all;">${info.seletor}</code>
                </div>

                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Dimensoes</div>
                    <div style="display: grid; grid-template-columns: 80px 1fr; gap: 6px;">
                        <span style="color: #94a3b8;">Tamanho:</span><span>${info.largura} x ${info.altura}</span>
                        <span style="color: #94a3b8;">Padding:</span><span>${info.padding}</span>
                        <span style="color: #94a3b8;">Margin:</span><span>${info.margin}</span>
                    </div>
                </div>

                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Estilos Visuais</div>
                    <div style="display: grid; grid-template-columns: 80px 1fr; gap: 6px;">
                        <span style="color: #94a3b8;">Background:</span><span style="display: flex; align-items: center; gap: 6px;"><span style="width: 16px; height: 16px; border-radius: 4px; background: ${info.background}; border: 1px solid #475569;"></span>${info.background}</span>
                        <span style="color: #94a3b8;">Cor texto:</span><span style="display: flex; align-items: center; gap: 6px;"><span style="width: 16px; height: 16px; border-radius: 4px; background: ${info.corTexto}; border: 1px solid #475569;"></span>${info.corTexto}</span>
                        <span style="color: #94a3b8;">Borda:</span><span>${info.borda}</span>
                        <span style="color: #94a3b8;">Radius:</span><span>${info.borderRadius}</span>
                    </div>
                </div>

                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Tipografia</div>
                    <div style="display: grid; grid-template-columns: 80px 1fr; gap: 6px;">
                        <span style="color: #94a3b8;">Fonte:</span><span>${info.fonte}</span>
                        <span style="color: #94a3b8;">Tamanho:</span><span>${info.tamanhoFonte}</span>
                        <span style="color: #94a3b8;">Peso:</span><span>${info.pesoFonte}</span>
                    </div>
                </div>

                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Hierarquia</div>
                    <code style="display: block; background: #0f172a; padding: 8px 12px; border-radius: 6px; font-size: 11px; color: #94a3b8; word-break: break-all;">${info.hierarquia}</code>
                </div>

                <div style="margin-bottom: 16px;">
                    <div style="color: #94a3b8; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Eventos JS</div>
                    <span style="color: ${info.eventos !== '-' ? '#f472b6' : '#64748b'};">${info.eventos}</span>
                </div>

                ${info.filhos && info.filhos.length > 0 ? `
                <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #334155;">
                    <div style="color: #fbbf24; font-size: 11px; text-transform: uppercase; margin-bottom: 6px;">Elementos Filhos (${info.filhos.length})</div>
                    <div style="max-height: 200px; overflow-y: auto; background: #0f172a; border-radius: 6px; padding: 8px;">
                        ${info.filhos.map(f => `
                            <div style="margin-bottom: 8px; padding: 6px; background: #1e293b; border-radius: 4px; font-size: 11px;">
                                <div style="color: #60a5fa; font-weight: 600;">[${f.num}] ${f.tag}${f.id !== '-' ? '#' + f.id : ''}${f.classes !== '-' ? '.' + f.classes : ''}</div>
                                <div style="color: #94a3b8; margin-top: 4px;">
                                    ${f.largura}x${f.altura} | bg: ${f.background} | radius: ${f.radius}
                                </div>
                                ${f.tag === 'select' ? `<div style="color: #4ade80; margin-top: 2px;">Valor: ${f.valor} | Opcoes: ${f.opcoes}</div>` : ''}
                                ${(f.tag === 'input' || f.tag === 'textarea') ? `<div style="color: #4ade80; margin-top: 2px;">${f.valor !== '-' ? 'Valor: ' + f.valor : ''}${f.placeholder !== '-' ? ' Placeholder: ' + f.placeholder : ''}</div>` : ''}
                                ${(f.tag === 'button' || f.tag === 'a') ? `<div style="color: #4ade80; margin-top: 2px;">Texto: ${f.texto}</div>` : ''}
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}

                <button onclick="copiarTudo()" style="width: 100%; background: ${CORES.copiar}; border: none; color: white; padding: 12px 16px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 600;">&#128203; COPIAR TUDO</button>
            </div>
        `;

        window._inspetorInfo = info;

        const popupWidth = 420;
        const popupHeight = 500;

        let posX = x + 10;
        let posY = y + 10;

        if (posX + popupWidth > window.innerWidth) {
            posX = x - popupWidth - 10;
        }
        if (posY + popupHeight > window.innerHeight) {
            posY = window.innerHeight - popupHeight - 20;
        }
        if (posY < 10) posY = 10;

        popup.style.left = posX + 'px';
        popup.style.top = posY + 'px';
        popup.style.display = 'block';
    }

    // Funcao global para copiar todas as informacoes
    window.copiarTudo = function() {
        const info = window._inspetorInfo;
        if (!info) return;

        const filhosTexto = info.filhos && info.filhos.length > 0 ? formatarFilhos(info.filhos) : '';

        const texto = `Aba: ${info.abaAtiva} | Sub-aba: ${info.subAbaAtiva} | Secao: ${info.tituloSecao} | Container: ${info.seletor} (${info.largura}x${info.altura}, bg: ${info.background}, radius: ${info.borderRadius}, padding: ${info.padding})${filhosTexto}`;

        navigator.clipboard.writeText(texto).then(() => {
            showToast('Todas as informacoes copiadas!');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Todas as informacoes copiadas!');
        });
    };

    // Funcao global para copiar texto
    window.copiarTexto = function(texto) {
        navigator.clipboard.writeText(texto).then(() => {
            showToast('Seletor copiado: ' + texto);
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Seletor copiado: ' + texto);
        });
    };

    // Toast de notificacao
    function showToast(msg) {
        let toast = document.getElementById('inspetor-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'inspetor-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 80px;
                right: 20px;
                z-index: 99999;
                background: ${CORES.fundo};
                color: ${CORES.texto};
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 13px;
                font-family: Inter, system-ui, sans-serif;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                opacity: 0;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = msg;
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2500);
    }

    // Inicializar quando DOM estiver pronto
    function init() {
        criarBotaoInspetor();
        criarOverlay();
        criarPopup();
        console.log('Inspetor carregado - Clique no botao para ativar');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
```

---

## Autor

Instrucao criada por Claude Code para uso em projetos futuros.
Controller: Alexsander Machado
