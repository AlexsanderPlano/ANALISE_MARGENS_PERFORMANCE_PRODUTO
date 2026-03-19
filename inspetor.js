/**
 * Mapa UI v2.0 — Modal com Ferramentas de Análise Visual
 * 6 ferramentas (do amplo ao específico):
 *   Design System | Estrutura DOM | Navegação | Heatmap | Interativos | Inspetor
 * Apenas Desktop (auto-detecta dispositivo)
 */

(function() {
    'use strict';

    // =========================================================
    // CONFIGURAÇÃO
    // =========================================================
    const CONFIG = {
        cores: {
            bg: '#0f172a',
            bgCard: '#1e293b',
            bgHover: '#334155',
            texto: '#f8fafc',
            textoMuted: '#94a3b8',
            accent: '#3b82f6',
            accentHover: '#2563eb',
            verde: '#22c55e',
            amarelo: '#fbbf24',
            laranja: '#f97316',
            rosa: '#ec4899',
            roxo: '#a78bfa',
            cyan: '#22d3ee',
            vermelho: '#ef4444',
            borda: '#334155'
        },
        modal: {
            width: '780px',
            height: '82vh',
            sidebarWidth: '68px'
        },
        zIndex: {
            overlay: 99990,
            modal: 99995,
            highlight: 99989,
            toast: 99999,
            btn: 99988
        }
    };

    // =========================================================
    // ESTADO GLOBAL
    // =========================================================
    const state = {
        modalAberto: false,
        ferramentaAtiva: 'design',
        inspetorAtivo: false,
        elementoDestacado: null,
        elementoInspecionado: null,
        funcaoCapturada: null,
        heatmapAtivo: false,
        heatmapOverlays: [],
        ultimoScan: null
    };

    // Registro de event listeners (monkey-patch)
    const eventListenersMap = new WeakMap();
    const originalAddEventListener = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        try {
            if (this instanceof Element) {
                if (!eventListenersMap.has(this)) eventListenersMap.set(this, []);
                eventListenersMap.get(this).push({
                    type,
                    name: (typeof listener === 'function' ? listener.name : '') || 'anonima'
                });
            }
        } catch(e) {}
        return originalAddEventListener.call(this, type, listener, options);
    };

    // Referências DOM
    let elModal, elSidebar, elConteudo, elOverlayModal, elHighlight, elBtnFlutuante, elToast;

    // =========================================================
    // UTILITÁRIOS
    // =========================================================

    function isDesktop() {
        return window.innerWidth > 1024 &&
            !/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    function obterSeletor(el) {
        if (!el || !el.tagName) return '?';
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        else if (el.classList.length > 0) s += '.' + Array.from(el.classList).join('.');
        return s;
    }

    function obterHierarquia(el, niveis = 4) {
        const h = [];
        let p = el;
        while (p && p !== document.body && h.length < niveis) {
            let nome = p.tagName.toLowerCase();
            if (p.id) nome += '#' + p.id;
            else if (p.classList.length > 0) nome += '.' + p.classList[0];
            h.unshift(nome);
            p = p.parentElement;
        }
        return h.join(' > ');
    }

    function rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
        const match = rgb.match(/(\d+),\s*(\d+),\s*(\d+)/);
        if (!match) return rgb;
        return '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('');
    }

    function showToast(msg) {
        if (!elToast) {
            elToast = document.createElement('div');
            elToast.id = 'inspetor-toast';
            elToast.style.cssText = `
                position: fixed; bottom: 80px; right: 20px; z-index: ${CONFIG.zIndex.toast};
                background: ${CONFIG.cores.bgCard}; color: ${CONFIG.cores.texto};
                padding: 12px 20px; border-radius: 8px; font-size: 13px;
                font-family: system-ui, sans-serif; box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
            `;
            document.body.appendChild(elToast);
        }
        elToast.textContent = msg;
        elToast.style.opacity = '1';
        clearTimeout(elToast._timer);
        elToast._timer = setTimeout(() => elToast.style.opacity = '0', 2500);
    }

    function copiarTexto(texto) {
        navigator.clipboard.writeText(texto).then(() => {
            showToast('Copiado!');
        }).catch(() => {
            const ta = document.createElement('textarea');
            ta.value = texto;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            showToast('Copiado!');
        });
    }

    // Cor swatch HTML
    function swatch(cor, tamanho = 14) {
        return `<span style="display:inline-block;width:${tamanho}px;height:${tamanho}px;border-radius:3px;background:${cor};border:1px solid ${CONFIG.cores.borda};vertical-align:middle;margin-right:6px;flex-shrink:0;"></span>`;
    }

    // =========================================================
    // CRIAR ESTRUTURA — BOTÃO FLUTUANTE
    // =========================================================

    function criarBotaoFlutuante() {
        elBtnFlutuante = document.createElement('button');
        elBtnFlutuante.id = 'btn-inspetor-v2';
        elBtnFlutuante.textContent = 'Mapa UI';
        elBtnFlutuante.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: ${CONFIG.zIndex.btn};
            padding: 10px 18px; background: ${CONFIG.cores.bg}; color: white; border: 1px solid ${CONFIG.cores.borda};
            border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;
            box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: all 0.2s ease;
            font-family: system-ui, sans-serif;
        `;
        elBtnFlutuante.addEventListener('click', toggleModal);
        elBtnFlutuante.addEventListener('mouseenter', () => elBtnFlutuante.style.borderColor = CONFIG.cores.accent);
        elBtnFlutuante.addEventListener('mouseleave', () => elBtnFlutuante.style.borderColor = CONFIG.cores.borda);
        document.body.appendChild(elBtnFlutuante);
    }

    // =========================================================
    // CRIAR ESTRUTURA — HIGHLIGHT (overlay de destaque na página)
    // =========================================================

    function criarHighlight() {
        elHighlight = document.createElement('div');
        elHighlight.id = 'inspetor-highlight';
        elHighlight.style.cssText = `
            position: fixed; pointer-events: none; z-index: ${CONFIG.zIndex.highlight};
            border: 2px solid ${CONFIG.cores.accent}; background: rgba(59,130,246,0.12);
            display: none; transition: all 0.08s ease;
        `;
        document.body.appendChild(elHighlight);
    }

    // =========================================================
    // CRIAR ESTRUTURA — MODAL PRINCIPAL
    // =========================================================

    function criarModal() {
        // Overlay escuro atrás do modal
        elOverlayModal = document.createElement('div');
        elOverlayModal.id = 'inspetor-overlay-modal';
        elOverlayModal.style.cssText = `
            position: fixed; inset: 0; z-index: ${CONFIG.zIndex.overlay};
            background: rgba(0,0,0,0.5); display: none; backdrop-filter: blur(2px);
        `;
        elOverlayModal.addEventListener('click', () => {
            if (!state.inspetorAtivo) fecharModal();
        });
        document.body.appendChild(elOverlayModal);

        // Modal
        elModal = document.createElement('div');
        elModal.id = 'inspetor-modal';
        elModal.style.cssText = `
            position: fixed; z-index: ${CONFIG.zIndex.modal};
            top: 50%; left: 50%; transform: translate(-50%, -50%);
            width: ${CONFIG.modal.width}; max-width: 95vw; height: ${CONFIG.modal.height}; max-height: 95vh;
            background: ${CONFIG.cores.bg}; border-radius: 16px; overflow: hidden;
            box-shadow: 0 25px 60px rgba(0,0,0,0.6); display: none;
            font-family: system-ui, -apple-system, sans-serif; color: ${CONFIG.cores.texto};
            border: 1px solid ${CONFIG.cores.borda};
        `;

        elModal.innerHTML = `
            <div id="inspetor-header" style="
                display: flex; align-items: center; justify-content: space-between;
                padding: 12px 18px; background: linear-gradient(135deg, ${CONFIG.cores.accent} 0%, ${CONFIG.cores.accentHover} 100%);
                border-bottom: 1px solid rgba(255,255,255,0.1); user-select: none; cursor: move;
            ">
                <span style="font-weight: 700; font-size: 14px; letter-spacing: 0.3px;">Mapa UI</span>
                <div style="display: flex; gap: 6px;">
                    <button id="inspetor-btn-min" title="Minimizar" style="
                        background: rgba(255,255,255,0.15); border: none; color: white;
                        width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 16px; line-height: 1;
                    ">−</button>
                    <button id="inspetor-btn-close" title="Fechar" style="
                        background: rgba(255,255,255,0.15); border: none; color: white;
                        width: 28px; height: 28px; border-radius: 6px; cursor: pointer; font-size: 14px; line-height: 1;
                    ">✕</button>
                </div>
            </div>
            <div id="inspetor-body" style="
                display: flex; height: calc(100% - 52px);
            ">
                <div id="inspetor-sidebar" style="
                    width: ${CONFIG.modal.sidebarWidth}; min-width: ${CONFIG.modal.sidebarWidth};
                    background: ${CONFIG.cores.bgCard}; border-right: 1px solid ${CONFIG.cores.borda};
                    display: flex; flex-direction: column; padding: 8px 0; gap: 2px; overflow-y: auto;
                "></div>
                <div id="inspetor-conteudo" style="
                    flex: 1; overflow-y: auto; padding: 16px;
                    font-size: 13px; line-height: 1.5;
                "></div>
            </div>
        `;

        document.body.appendChild(elModal);

        elSidebar = elModal.querySelector('#inspetor-sidebar');
        elConteudo = elModal.querySelector('#inspetor-conteudo');

        // Eventos header
        elModal.querySelector('#inspetor-btn-close').addEventListener('click', fecharModal);
        elModal.querySelector('#inspetor-btn-min').addEventListener('click', minimizarModal);

        // Drag modal
        habilitarDrag(elModal.querySelector('#inspetor-header'), elModal);

        // Popular sidebar
        criarSidebar();
    }

    // Ferramentas disponíveis
    const FERRAMENTAS = [
        { id: 'design',      icon: '🎨', label: 'Design',      desc: 'Design System Scanner' },
        { id: 'arvore',      icon: '🌳', label: 'Árvore',      desc: 'Estrutura DOM' },
        { id: 'navegacao',   icon: '🗺️', label: 'Naveg.',      desc: 'Mapa de navegação' },
        { id: 'heatmap',     icon: '🎯', label: 'Heatmap',     desc: 'Mapa visual de blocos' },
        { id: 'interativos', icon: '⚡', label: 'Ações',       desc: 'Elementos interativos' },
        { id: 'inspetor',    icon: '🔍', label: 'Inspetor',    desc: 'Inspecionar elemento' }
    ];

    function criarSidebar() {
        elSidebar.innerHTML = '';
        FERRAMENTAS.forEach(f => {
            const btn = document.createElement('button');
            btn.dataset.tool = f.id;
            btn.title = f.desc;
            btn.innerHTML = `<span style="font-size:18px;display:block;line-height:1;">${f.icon}</span><span style="font-size:9px;margin-top:2px;display:block;opacity:0.8;">${f.label}</span>`;
            btn.style.cssText = `
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                width: 56px; height: 52px; margin: 0 auto; border: none; border-radius: 10px;
                cursor: pointer; transition: all 0.15s ease; background: transparent; color: ${CONFIG.cores.textoMuted};
                padding: 4px;
            `;
            btn.addEventListener('click', () => selecionarFerramenta(f.id));
            btn.addEventListener('mouseenter', () => {
                if (state.ferramentaAtiva !== f.id) btn.style.background = CONFIG.cores.bgHover;
            });
            btn.addEventListener('mouseleave', () => {
                if (state.ferramentaAtiva !== f.id) btn.style.background = 'transparent';
            });
            elSidebar.appendChild(btn);
        });
        atualizarSidebarAtiva();
    }

    function atualizarSidebarAtiva() {
        elSidebar.querySelectorAll('button').forEach(btn => {
            const ativo = btn.dataset.tool === state.ferramentaAtiva;
            btn.style.background = ativo ? CONFIG.cores.accent : 'transparent';
            btn.style.color = ativo ? 'white' : CONFIG.cores.textoMuted;
        });
    }

    // Drag do modal
    function habilitarDrag(handle, target) {
        let isDragging = false, startX, startY, origX, origY;
        handle.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            startX = e.clientX; startY = e.clientY;
            const rect = target.getBoundingClientRect();
            origX = rect.left + rect.width / 2;
            origY = rect.top + rect.height / 2;
            target.style.transition = 'none';
        });
        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            target.style.left = (origX + dx) + 'px';
            target.style.top = (origY + dy) + 'px';
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            target.style.transition = '';
        });
    }

    // =========================================================
    // CONTROLE DO MODAL
    // =========================================================

    function toggleModal() {
        if (state.modalAberto) fecharModal();
        else abrirModal();
    }

    function abrirModal() {
        state.modalAberto = true;
        elModal.style.display = 'block';
        elOverlayModal.style.display = 'block';
        elBtnFlutuante.style.display = 'none';
        // Reset posição
        elModal.style.left = '50%';
        elModal.style.top = '50%';
        elModal.style.transform = 'translate(-50%, -50%)';
        selecionarFerramenta(state.ferramentaAtiva);
    }

    function fecharModal() {
        state.modalAberto = false;
        elModal.style.display = 'none';
        elOverlayModal.style.display = 'none';
        elBtnFlutuante.style.display = 'block';
        desativarInspetor();
        limparHeatmap();
    }

    function minimizarModal() {
        // Minimiza: esconde modal mas mantém overlay e modo inspetor se ativo
        elModal.style.display = 'none';
        if (!state.inspetorAtivo) {
            elOverlayModal.style.display = 'none';
            elBtnFlutuante.style.display = 'block';
        }
    }

    function restaurarModal() {
        elModal.style.display = 'block';
        elOverlayModal.style.display = 'block';
    }

    // =========================================================
    // SELEÇÃO DE FERRAMENTA
    // =========================================================

    function selecionarFerramenta(id) {
        // Desativar ferramentas anteriores
        if (state.ferramentaAtiva === 'inspetor' && id !== 'inspetor') desativarInspetor();
        if (state.ferramentaAtiva === 'heatmap' && id !== 'heatmap') limparHeatmap();

        state.ferramentaAtiva = id;
        atualizarSidebarAtiva();

        switch(id) {
            case 'inspetor':    renderInspetor(); break;
            case 'arvore':      renderArvore(); break;
            case 'interativos': renderInterativos(); break;
            case 'design':      renderDesign(); break;
            case 'navegacao':   renderNavegacao(); break;
            case 'heatmap':     renderHeatmap(); break;
        }
    }

    // =========================================================
    // HELPER: Seção HTML
    // =========================================================

    function secao(titulo, conteudo, opts = {}) {
        const corTitulo = opts.corTitulo || CONFIG.cores.amarelo;
        const bgSec = opts.bg || CONFIG.cores.bgCard;
        return `
            <div style="margin-bottom: 12px; background: ${bgSec}; border-radius: 10px; overflow: hidden;">
                <div style="padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: ${corTitulo}; font-weight: 600; border-bottom: 1px solid ${CONFIG.cores.borda};">${titulo}</div>
                <div style="padding: 12px 14px;">${conteudo}</div>
            </div>
        `;
    }

    function grid2(label, valor, corValor) {
        const cv = corValor || CONFIG.cores.texto;
        return `<span style="color:${CONFIG.cores.textoMuted};font-size:12px;">${label}</span><span style="color:${cv};font-size:12px;word-break:break-all;">${valor}</span>`;
    }

    function btnCopiar(texto, label = 'COPIAR') {
        const id = 'cp_' + Math.random().toString(36).slice(2, 8);
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) el.addEventListener('click', () => copiarTexto(texto));
        }, 50);
        return `<button id="${id}" style="
            background: ${CONFIG.cores.accent}; border: none; color: white; padding: 10px 16px;
            border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; width: 100%;
            margin-top: 8px; transition: background 0.15s;
        " onmouseenter="this.style.background='${CONFIG.cores.accentHover}'"
           onmouseleave="this.style.background='${CONFIG.cores.accent}'"
        >${label}</button>`;
    }

    // =========================================================
    // TOOL 1: INSPETOR (inspecionar elemento individual)
    // =========================================================

    function renderInspetor() {
        if (state.elementoInspecionado) {
            renderInfoElemento(state.elementoInspecionado);
        } else {
            elConteudo.innerHTML = `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">🔍</div>
                    <h3 style="margin: 0 0 8px; font-size: 16px; color: ${CONFIG.cores.texto};">Inspetor de Elementos</h3>
                    <p style="color: ${CONFIG.cores.textoMuted}; font-size: 13px; margin: 0 0 24px;">
                        Ative o modo inspetor para selecionar elementos na página.
                    </p>
                    <button id="btn-ativar-inspetor" style="
                        background: ${CONFIG.cores.accent}; border: none; color: white;
                        padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;
                        cursor: pointer; transition: all 0.15s;
                    ">Ativar Inspetor</button>
                    <p style="color: ${CONFIG.cores.textoMuted}; font-size: 11px; margin-top: 16px;">
                        Clique esquerdo = captura função &nbsp;|&nbsp; Clique direito = inspeciona
                    </p>
                </div>
            `;
            document.getElementById('btn-ativar-inspetor').addEventListener('click', ativarInspetor);
        }
    }

    function ativarInspetor() {
        state.inspetorAtivo = true;
        state.funcaoCapturada = null;
        // Minimizar modal para inspecionar a página
        elModal.style.display = 'none';
        elOverlayModal.style.display = 'none';
        elBtnFlutuante.style.display = 'block';
        elBtnFlutuante.textContent = '✕ Fechar';
        elBtnFlutuante.style.background = CONFIG.cores.vermelho;
        elBtnFlutuante.style.borderColor = CONFIG.cores.vermelho;

        document.addEventListener('mousemove', onInspetorMouseMove);
        document.addEventListener('contextmenu', onInspetorRightClick);
        document.addEventListener('click', onInspetorLeftClick, true);
        showToast('Inspetor ativado — Esquerdo: captura função | Direito: inspeciona');
    }

    function desativarInspetor() {
        if (!state.inspetorAtivo) return;
        state.inspetorAtivo = false;
        elHighlight.style.display = 'none';
        elBtnFlutuante.textContent = 'Mapa UI';
        elBtnFlutuante.style.background = CONFIG.cores.bg;
        elBtnFlutuante.style.borderColor = CONFIG.cores.borda;

        document.removeEventListener('mousemove', onInspetorMouseMove);
        document.removeEventListener('contextmenu', onInspetorRightClick);
        document.removeEventListener('click', onInspetorLeftClick, true);
    }

    function isInspetor(el) {
        if (!el) return false;
        return el === elBtnFlutuante || el === elModal || el === elOverlayModal ||
               el === elHighlight || el === elToast ||
               elModal.contains(el);
    }

    function onInspetorMouseMove(e) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || isInspetor(el)) return;
        state.elementoDestacado = el;
        const rect = el.getBoundingClientRect();
        elHighlight.style.display = 'block';
        elHighlight.style.top = rect.top + 'px';
        elHighlight.style.left = rect.left + 'px';
        elHighlight.style.width = rect.width + 'px';
        elHighlight.style.height = rect.height + 'px';
    }

    function onInspetorLeftClick(e) {
        if (!state.inspetorAtivo || isInspetor(e.target)) return;
        const el = e.target;
        const info = obterInfoFuncao(el);
        state.funcaoCapturada = {
            seletor: obterSeletor(el),
            funcao: info.funcao,
            tipo: info.tipo,
            listeners: info.todosListeners,
            hora: new Date().toLocaleTimeString()
        };
        if (info.funcao !== 'nenhuma') showToast('Capturado: ' + info.funcao);
        else showToast('Clique em: ' + obterSeletor(el).substring(0, 30));
    }

    function onInspetorRightClick(e) {
        if (!state.inspetorAtivo || isInspetor(e.target)) return;
        e.preventDefault();
        state.elementoInspecionado = e.target;
        elHighlight.style.display = 'none';
        desativarInspetor();
        abrirModal();
        renderInfoElemento(e.target);
    }

    function obterInfoFuncao(el) {
        let funcao = 'nenhuma', tipo = '';
        let atual = el, nivel = 0;
        while (atual && nivel < 5 && funcao === 'nenhuma') {
            const onclick = atual.getAttribute && atual.getAttribute('onclick');
            if (onclick) {
                const m = onclick.match(/^(\w+)\s*\(/);
                funcao = m ? m[1] + '()' : onclick.substring(0, 40);
                tipo = nivel === 0 ? 'onclick' : `onclick (pai: ${obterSeletor(atual)})`;
                break;
            }
            const listeners = eventListenersMap.get(atual) || [];
            const clicks = listeners.filter(l => l.type === 'click');
            if (clicks.length > 0) {
                funcao = clicks.map(l => l.name + '()').join(', ');
                tipo = nivel === 0 ? 'addEventListener' : `addEventListener (pai: ${obterSeletor(atual)})`;
                break;
            }
            if (atual.onclick && typeof atual.onclick === 'function') {
                funcao = (atual.onclick.name || 'anonima') + '()';
                tipo = nivel === 0 ? 'onclick prop' : `onclick prop (pai: ${obterSeletor(atual)})`;
                break;
            }
            atual = atual.parentElement;
            nivel++;
        }
        if (el.tagName === 'A' && el.href && funcao === 'nenhuma') {
            funcao = 'navegar → ' + (el.href.length > 30 ? el.href.substring(0, 30) + '...' : el.href);
            tipo = 'link';
        }
        const listeners = eventListenersMap.get(el) || [];
        const todosListeners = listeners.map(l => `${l.type}: ${l.name}()`).join(', ') || 'nenhum';
        return { funcao, tipo, todosListeners };
    }

    function capturarEventosElemento(el) {
        const eventos = [];
        const inlineEvts = ['onclick','onchange','oninput','onsubmit','onfocus','onblur','onkeyup','onkeydown','ondblclick','onmouseover'];
        inlineEvts.forEach(attr => {
            const v = el.getAttribute(attr);
            if (v) {
                const m = v.match(/^(\w+)\s*\(/);
                eventos.push(`${attr.replace('on','')}: ${m ? m[1]+'()' : v.substring(0,30)}`);
            }
        });
        ['click','change','input','submit','focus','blur'].forEach(tipo => {
            if (el['on'+tipo] && typeof el['on'+tipo] === 'function') {
                const n = el['on'+tipo].name || 'anonima';
                if (!eventos.some(e => e.startsWith(tipo+':'))) eventos.push(`${tipo}: ${n}()`);
            }
        });
        return eventos.length > 0 ? eventos.join(' | ') : 'nenhum';
    }

    function renderInfoElemento(el) {
        const cs = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        const seletor = obterSeletor(el);
        const hierarquia = obterHierarquia(el);
        const eventos = capturarEventosElemento(el);

        let conteudo = '';
        const textos = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent.trim()).filter(t => t);
        conteudo = textos.length > 0 ? textos.join(' ') : (el.textContent?.trim() || '');
        conteudo = conteudo.replace(/\s+/g, ' ').substring(0, 100);
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') conteudo = el.value || el.placeholder || '-';
        if (el.tagName === 'IMG') conteudo = el.alt || el.src?.split('/').pop() || '-';

        const distL = Math.round(rect.left), distR = Math.round(window.innerWidth - rect.right);
        const distT = Math.round(rect.top), distB = Math.round(window.innerHeight - rect.bottom);

        let html = '';

        // Contexto
        html += secao('Contexto', `
            <div style="display:grid;grid-template-columns:70px 1fr;gap:4px;">
                ${grid2('Seletor', `<code style="color:${CONFIG.cores.rosa};">${seletor}</code>`)}
                ${grid2('ID', el.id || '-', CONFIG.cores.amarelo)}
                ${grid2('Classes', el.classList.length > 0 ? Array.from(el.classList).join(' ') : '-', CONFIG.cores.verde)}
            </div>
        `);

        // Conteúdo
        if (conteudo && conteudo !== '-') {
            html += secao('Conteúdo', `<div style="font-size:13px;word-break:break-word;">${conteudo}</div>`);
        }

        // Função capturada
        if (state.funcaoCapturada) {
            html += secao('Função Capturada (Clique)', `
                <div style="color:${CONFIG.cores.amarelo};font-size:14px;font-weight:600;margin-bottom:4px;">${state.funcaoCapturada.funcao}</div>
                <div style="color:${CONFIG.cores.textoMuted};font-size:11px;">via ${state.funcaoCapturada.tipo || 'clique'} em ${state.funcaoCapturada.seletor}</div>
                <div style="color:${CONFIG.cores.bgHover};font-size:10px;margin-top:4px;">${state.funcaoCapturada.hora}</div>
            `, { corTitulo: CONFIG.cores.laranja, bg: '#2d1f0f' });
        }

        // Eventos JS
        html += secao('Eventos JS', `<div style="color:${eventos !== 'nenhum' ? CONFIG.cores.verde : CONFIG.cores.textoMuted};font-size:12px;">${eventos}</div>`,
            { corTitulo: CONFIG.cores.verde, bg: eventos !== 'nenhum' ? '#1e3a2f' : CONFIG.cores.bgCard });

        // Dimensões + Posição
        html += secao('Dimensões e Posição', `
            <div style="display:grid;grid-template-columns:80px 1fr;gap:4px;">
                ${grid2('Tamanho', `${Math.round(rect.width)}px × ${Math.round(rect.height)}px`)}
                ${grid2('Padding', cs.padding, CONFIG.cores.verde)}
                ${grid2('Margin', cs.margin, CONFIG.cores.laranja)}
                ${grid2('Posição', `↑${distT}px ←${distL}px →${distR}px ↓${distB}px`, CONFIG.cores.cyan)}
                ${grid2('Viewport', `${window.innerWidth} × ${window.innerHeight}`)}
            </div>
        `);

        // Estilos visuais
        html += secao('Estilos', `
            <div style="display:grid;grid-template-columns:80px 1fr;gap:4px;">
                ${grid2('Background', `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.backgroundColor)}${cs.backgroundColor}</span>`)}
                ${grid2('Cor texto', `<span style="display:flex;align-items:center;gap:4px;">${swatch(cs.color)}${cs.color}</span>`)}
                ${grid2('Borda', cs.border !== 'none' ? cs.border : '-')}
                ${grid2('Radius', cs.borderRadius)}
                ${grid2('Fonte', `${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize} (${cs.fontWeight})`)}
            </div>
        `);

        // Hierarquia
        html += secao('Hierarquia', `<code style="font-size:11px;color:${CONFIG.cores.textoMuted};word-break:break-all;">${hierarquia}</code>`);

        // Botão copiar
        const textoCopiavel = montarTextoCopiavel(el, cs, rect, eventos);
        html += btnCopiar(textoCopiavel, 'COPIAR TUDO');

        // Botão novo inspetor
        html += `<button id="btn-reinspecionar" style="
            background: transparent; border: 1px solid ${CONFIG.cores.borda}; color: ${CONFIG.cores.textoMuted};
            padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 12px; width: 100%; margin-top: 6px;
        ">Inspecionar outro elemento</button>`;

        elConteudo.innerHTML = html;

        document.getElementById('btn-reinspecionar').addEventListener('click', () => {
            state.elementoInspecionado = null;
            ativarInspetor();
        });
    }

    function montarTextoCopiavel(el, cs, rect, eventos) {
        const seletor = obterSeletor(el);
        const distL = Math.round(rect.left), distR = Math.round(window.innerWidth - rect.right);
        const distT = Math.round(rect.top), distB = Math.round(window.innerHeight - rect.bottom);
        const funcaoTxt = state.funcaoCapturada ? ` | FUNCAO: ${state.funcaoCapturada.funcao} (${state.funcaoCapturada.tipo} em ${state.funcaoCapturada.seletor})` : '';
        const eventosTxt = eventos !== 'nenhum' ? ` | Eventos: ${eventos}` : '';
        return `Elemento: ${seletor} (${Math.round(rect.width)}x${Math.round(rect.height)}, bg: ${cs.backgroundColor}, cor: ${cs.color}, fonte: ${cs.fontFamily.split(',')[0].replace(/"/g,'')} ${cs.fontSize} ${cs.fontWeight}, radius: ${cs.borderRadius}, padding: ${cs.padding}, margin: ${cs.margin}, posicao: ↑${distT} ←${distL} →${distR} ↓${distB})${funcaoTxt}${eventosTxt}`;
    }

    // =========================================================
    // TOOL 2: ÁRVORE DOM
    // =========================================================

    function renderArvore() {
        const tree = scanArvore(document.body, 0, 4);
        let html = `
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted}; text-transform: uppercase; letter-spacing: 0.5px;">Estrutura DOM</span>
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted};">Profundidade: 4 níveis</span>
            </div>
        `;
        html += `<div style="background: ${CONFIG.cores.bgCard}; border-radius: 10px; padding: 12px; font-family: monospace; font-size: 12px; overflow-x: auto;">`;
        html += renderArvoreNode(tree, 0);
        html += '</div>';

        // Copiar
        const textoArvore = gerarTextoArvore(tree, 0);
        html += btnCopiar(textoArvore, 'COPIAR ÁRVORE');

        elConteudo.innerHTML = html;
    }

    function scanArvore(el, depth, maxDepth) {
        if (depth >= maxDepth) return null;
        const tag = el.tagName?.toLowerCase();
        if (!tag) return null;

        // Ignorar elementos do inspetor
        if (el.id && el.id.startsWith('inspetor-')) return null;
        if (el.id === 'btn-inspetor-v2') return null;

        // Só incluir elementos estruturais ou com identidade
        const estruturais = ['html','body','header','nav','main','section','article','aside','footer','div','form','table','ul','ol','dialog'];
        const temIdentidade = el.id || (el.classList.length > 0);
        const ehEstrutural = estruturais.includes(tag);

        if (!ehEstrutural && !temIdentidade && depth > 1) return null;

        const rect = el.getBoundingClientRect();
        // Ignorar elementos invisíveis (exceto body)
        if (tag !== 'body' && (rect.width === 0 || rect.height === 0)) return null;

        const node = {
            tag,
            id: el.id || '',
            classes: el.classList.length > 0 ? Array.from(el.classList).slice(0, 3).join('.') : '',
            largura: Math.round(rect.width),
            altura: Math.round(rect.height),
            filhos: []
        };

        Array.from(el.children).forEach(child => {
            const childNode = scanArvore(child, depth + 1, maxDepth);
            if (childNode) node.filhos.push(childNode);
        });

        return node;
    }

    function renderArvoreNode(node, indent) {
        if (!node) return '';
        const pad = '&nbsp;'.repeat(indent * 3);
        const id = node.id ? `<span style="color:${CONFIG.cores.amarelo};">#${node.id}</span>` : '';
        const cls = node.classes ? `<span style="color:${CONFIG.cores.verde};">.${node.classes}</span>` : '';
        const dim = `<span style="color:${CONFIG.cores.textoMuted};font-size:10px;margin-left:8px;">${node.largura}×${node.altura}</span>`;

        let html = `<div style="margin: 1px 0; white-space: nowrap;">${pad}<span style="color:${CONFIG.cores.cyan};">&lt;${node.tag}&gt;</span>${id}${cls}${dim}</div>`;

        node.filhos.forEach(f => {
            html += renderArvoreNode(f, indent + 1);
        });
        return html;
    }

    function gerarTextoArvore(node, indent) {
        if (!node) return '';
        const pad = '  '.repeat(indent);
        const id = node.id ? '#' + node.id : '';
        const cls = node.classes ? '.' + node.classes : '';
        let txt = `${pad}<${node.tag}>${id}${cls} (${node.largura}×${node.altura})\n`;
        node.filhos.forEach(f => { txt += gerarTextoArvore(f, indent + 1); });
        return txt;
    }

    // =========================================================
    // TOOL 3: ELEMENTOS INTERATIVOS
    // =========================================================

    function renderInterativos() {
        const elementos = scanInterativos();
        const grupos = { button: [], input: [], select: [], textarea: [], a: [] };

        elementos.forEach(el => {
            const tag = el.tag;
            if (grupos[tag]) grupos[tag].push(el);
            else if (tag === 'button' || el.role === 'button') grupos.button.push(el);
        });

        let html = `
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted}; text-transform: uppercase;">Elementos Interativos</span>
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted};">${elementos.length} encontrados</span>
            </div>
        `;

        const labels = { button: 'Botões', input: 'Inputs', select: 'Selects', textarea: 'Textareas', a: 'Links' };
        const icons = { button: '🔘', input: '📝', select: '📋', textarea: '📄', a: '🔗' };

        let textoCompleto = '';

        for (const [tag, items] of Object.entries(grupos)) {
            if (items.length === 0) continue;
            let conteudo = '';
            items.forEach((item, i) => {
                conteudo += `
                    <div style="padding: 8px; margin-bottom: 4px; background: ${CONFIG.cores.bg}; border-radius: 6px; font-size: 11px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <span style="color:${CONFIG.cores.cyan};font-weight:600;">${item.seletor}</span>
                            <span style="color:${CONFIG.cores.textoMuted};font-size:10px;">${item.largura}×${item.altura}</span>
                        </div>
                        ${item.texto ? `<div style="color:${CONFIG.cores.texto};margin-top:3px;">Texto: "${item.texto}"</div>` : ''}
                        ${item.valor ? `<div style="color:${CONFIG.cores.verde};margin-top:3px;">Valor: "${item.valor}"</div>` : ''}
                        ${item.placeholder ? `<div style="color:${CONFIG.cores.textoMuted};margin-top:3px;">Placeholder: "${item.placeholder}"</div>` : ''}
                        ${item.opcoes ? `<div style="color:${CONFIG.cores.roxo};margin-top:3px;">Opções: ${item.opcoes}</div>` : ''}
                        ${item.eventos !== 'nenhum' ? `<div style="color:${CONFIG.cores.laranja};margin-top:3px;">Eventos: ${item.eventos}</div>` : ''}
                    </div>
                `;
                textoCompleto += `[${tag.toUpperCase()}] ${item.seletor}${item.texto ? ' "'+item.texto+'"' : ''}${item.eventos !== 'nenhum' ? ' | '+item.eventos : ''}\n`;
            });
            html += secao(`${icons[tag]} ${labels[tag]} (${items.length})`, conteudo);
        }

        html += btnCopiar(textoCompleto.trim(), 'COPIAR LISTA');
        elConteudo.innerHTML = html;
    }

    function scanInterativos() {
        const seletores = 'button, input, select, textarea, a[href], [role="button"], [onclick]';
        const els = document.querySelectorAll(seletores);
        const resultado = [];

        els.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;

            const tag = el.tagName.toLowerCase();
            const item = {
                tag,
                seletor: obterSeletor(el),
                largura: Math.round(rect.width),
                altura: Math.round(rect.height),
                eventos: capturarEventosElemento(el)
            };

            if (tag === 'button' || tag === 'a') item.texto = el.textContent?.trim().substring(0, 40) || '';
            if (tag === 'input' || tag === 'textarea') {
                item.tipo = el.type || 'text';
                item.valor = el.value || '';
                item.placeholder = el.placeholder || '';
            }
            if (tag === 'select') {
                item.valor = el.options[el.selectedIndex]?.text || '';
                item.opcoes = Array.from(el.options).map(o => o.text).join(', ');
            }

            resultado.push(item);
        });

        return resultado;
    }

    // =========================================================
    // TOOL 4: DESIGN SYSTEM SCANNER
    // =========================================================

    function renderDesign() {
        const scan = scanDesignSystem();
        state.ultimoScan = scan;

        let html = `
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted}; text-transform: uppercase;">Design System Scanner</span>
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted};">${scan.totalElementos} elementos analisados</span>
            </div>
        `;

        // PALETA DE CORES
        let coresHtml = '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
        scan.cores.backgrounds.slice(0, 12).forEach(c => {
            coresHtml += `
                <div style="text-align: center; cursor: pointer;" onclick="navigator.clipboard.writeText('${c.hex || c.valor}');" title="Clique para copiar">
                    <div style="width: 40px; height: 40px; border-radius: 8px; background: ${c.valor}; border: 1px solid ${CONFIG.cores.borda};"></div>
                    <div style="font-size: 9px; color: ${CONFIG.cores.textoMuted}; margin-top: 3px;">${c.hex || c.valor}</div>
                    <div style="font-size: 9px; color: ${CONFIG.cores.textoMuted};">×${c.qtd}</div>
                </div>
            `;
        });
        coresHtml += '</div>';

        if (scan.cores.textos.length > 0) {
            coresHtml += `<div style="margin-top: 10px; font-size: 11px; color: ${CONFIG.cores.textoMuted}; margin-bottom: 6px;">Cores de Texto:</div>`;
            coresHtml += '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
            scan.cores.textos.slice(0, 8).forEach(c => {
                coresHtml += `
                    <div style="display:flex;align-items:center;gap:4px;background:${CONFIG.cores.bg};padding:4px 8px;border-radius:6px;cursor:pointer;" onclick="navigator.clipboard.writeText('${c.hex || c.valor}');" title="Copiar">
                        ${swatch(c.valor)} <span style="font-size:11px;">${c.hex || c.valor}</span> <span style="font-size:10px;color:${CONFIG.cores.textoMuted};">×${c.qtd}</span>
                    </div>
                `;
            });
            coresHtml += '</div>';
        }

        if (scan.cores.bordas.length > 0) {
            coresHtml += `<div style="margin-top: 10px; font-size: 11px; color: ${CONFIG.cores.textoMuted}; margin-bottom: 6px;">Cores de Borda:</div>`;
            coresHtml += '<div style="display: flex; flex-wrap: wrap; gap: 6px;">';
            scan.cores.bordas.slice(0, 6).forEach(c => {
                coresHtml += `
                    <div style="display:flex;align-items:center;gap:4px;background:${CONFIG.cores.bg};padding:4px 8px;border-radius:6px;">
                        ${swatch(c.valor)} <span style="font-size:11px;">${c.hex || c.valor}</span> <span style="font-size:10px;color:${CONFIG.cores.textoMuted};">×${c.qtd}</span>
                    </div>
                `;
            });
            coresHtml += '</div>';
        }

        html += secao('🎨 Paleta de Cores', coresHtml);

        // TIPOGRAFIA
        let tipoHtml = '';
        scan.tipografia.fontes.forEach(f => {
            tipoHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;display:flex;justify-content:space-between;">
                <span style="font-family:${f.valor};font-size:13px;">${f.valor}</span>
                <span style="color:${CONFIG.cores.textoMuted};font-size:11px;">×${f.qtd}</span>
            </div>`;
        });
        tipoHtml += `<div style="margin-top:8px;font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Tamanhos:</div>`;
        tipoHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        scan.tipografia.tamanhos.slice(0, 10).forEach(t => {
            tipoHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;">${t.valor} <span style="color:${CONFIG.cores.textoMuted};">×${t.qtd}</span></span>`;
        });
        tipoHtml += '</div>';
        tipoHtml += `<div style="margin-top:8px;font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Pesos:</div>`;
        tipoHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        scan.tipografia.pesos.forEach(p => {
            tipoHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;font-weight:${p.valor};">${p.valor} <span style="color:${CONFIG.cores.textoMuted};">×${p.qtd}</span></span>`;
        });
        tipoHtml += '</div>';
        html += secao('🔤 Tipografia', tipoHtml);

        // ESPAÇAMENTOS
        let espHtml = '';
        espHtml += `<div style="font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Paddings mais usados:</div>`;
        espHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
        scan.espacamentos.paddings.slice(0, 8).forEach(p => {
            espHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;color:${CONFIG.cores.verde};">${p.valor} <span style="color:${CONFIG.cores.textoMuted};">×${p.qtd}</span></span>`;
        });
        espHtml += '</div>';
        espHtml += `<div style="font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Margins mais usados:</div>`;
        espHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">';
        scan.espacamentos.margins.slice(0, 8).forEach(m => {
            espHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;color:${CONFIG.cores.laranja};">${m.valor} <span style="color:${CONFIG.cores.textoMuted};">×${m.qtd}</span></span>`;
        });
        espHtml += '</div>';
        espHtml += `<div style="font-size:11px;color:${CONFIG.cores.textoMuted};margin-bottom:6px;">Border-radius:</div>`;
        espHtml += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
        scan.espacamentos.radiuses.slice(0, 6).forEach(r => {
            espHtml += `<span style="background:${CONFIG.cores.bg};padding:3px 8px;border-radius:4px;font-size:11px;color:${CONFIG.cores.cyan};">${r.valor} <span style="color:${CONFIG.cores.textoMuted};">×${r.qtd}</span></span>`;
        });
        espHtml += '</div>';
        html += secao('📐 Espaçamentos', espHtml);

        // COMPONENTES (botões, inputs, tabelas, cards)
        let compHtml = '';

        // Botões
        if (scan.componentes.botoes.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-bottom:6px;font-weight:600;">Botões (${scan.componentes.botoes.length} estilos)</div>`;
            scan.componentes.botoes.slice(0, 5).forEach(b => {
                compHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="display:flex;align-items:center;gap:6px;">
                        ${swatch(b.bg)} <span style="color:${CONFIG.cores.cyan};">${b.exemplo}</span>
                        <span style="color:${CONFIG.cores.textoMuted};">×${b.qtd}</span>
                    </div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">bg: ${b.bg} | cor: ${b.cor} | radius: ${b.radius} | padding: ${b.padding}</div>
                </div>`;
            });
        }

        // Tabelas
        if (scan.componentes.tabelas.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-top:12px;margin-bottom:6px;font-weight:600;">Tabelas (${scan.componentes.tabelas.length})</div>`;
            scan.componentes.tabelas.forEach(t => {
                compHtml += `<div style="padding:8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="color:${CONFIG.cores.cyan};font-weight:600;">${t.seletor}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:3px;">Colunas: ${t.colunas} | Linhas: ${t.linhas}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">Header bg: ${t.headerBg} | Header cor: ${t.headerCor}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">Body bg: ${t.bodyBg} | Borda: ${t.borda}</div>
                    ${t.headers ? `<div style="color:${CONFIG.cores.roxo};margin-top:2px;">Headers: ${t.headers}</div>` : ''}
                </div>`;
            });
        }

        // Cards
        if (scan.componentes.cards.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-top:12px;margin-bottom:6px;font-weight:600;">Cards/Painéis (${scan.componentes.cards.length} estilos)</div>`;
            scan.componentes.cards.slice(0, 5).forEach(c => {
                compHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="display:flex;align-items:center;gap:6px;">${swatch(c.bg)} <span style="color:${CONFIG.cores.cyan};">${c.exemplo}</span> <span style="color:${CONFIG.cores.textoMuted};">×${c.qtd}</span></div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">bg: ${c.bg} | radius: ${c.radius} | shadow: ${c.shadow ? 'sim' : 'não'} | padding: ${c.padding}</div>
                </div>`;
            });
        }

        // Inputs
        if (scan.componentes.inputs.length > 0) {
            compHtml += `<div style="font-size:11px;color:${CONFIG.cores.amarelo};margin-top:12px;margin-bottom:6px;font-weight:600;">Inputs (${scan.componentes.inputs.length} estilos)</div>`;
            scan.componentes.inputs.slice(0, 4).forEach(inp => {
                compHtml += `<div style="padding:6px 8px;margin-bottom:4px;background:${CONFIG.cores.bg};border-radius:6px;font-size:11px;">
                    <div style="color:${CONFIG.cores.cyan};">${inp.exemplo}</div>
                    <div style="color:${CONFIG.cores.textoMuted};margin-top:2px;">bg: ${inp.bg} | borda: ${inp.borda} | radius: ${inp.radius} | padding: ${inp.padding} | ×${inp.qtd}</div>
                </div>`;
            });
        }

        html += secao('🧩 Componentes', compHtml || '<span style="color:#64748b;">Nenhum componente encontrado</span>');

        // Copiar resumo
        const resumo = gerarResumoDesign(scan);
        html += btnCopiar(resumo, 'COPIAR DESIGN SYSTEM');

        elConteudo.innerHTML = html;
    }

    function scanDesignSystem() {
        const allElements = document.querySelectorAll('body *');
        const bgMap = {}, txtMap = {}, bordaMap = {};
        const fonteMap = {}, tamanhoMap = {}, pesoMap = {};
        const paddingMap = {}, marginMap = {}, radiusMap = {};
        let total = 0;

        allElements.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            const cs = window.getComputedStyle(el);
            total++;

            // Cores
            const bg = cs.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
                bgMap[bg] = (bgMap[bg] || 0) + 1;
            }
            const cor = cs.color;
            if (cor) txtMap[cor] = (txtMap[cor] || 0) + 1;

            const bc = cs.borderColor;
            if (bc && cs.borderWidth !== '0px' && bc !== 'rgb(0, 0, 0)') {
                bordaMap[bc] = (bordaMap[bc] || 0) + 1;
            }

            // Tipografia
            const fonte = cs.fontFamily.split(',')[0].replace(/"/g, '').trim();
            if (fonte) fonteMap[fonte] = (fonteMap[fonte] || 0) + 1;
            tamanhoMap[cs.fontSize] = (tamanhoMap[cs.fontSize] || 0) + 1;
            pesoMap[cs.fontWeight] = (pesoMap[cs.fontWeight] || 0) + 1;

            // Espaçamentos
            const p = cs.padding;
            if (p && p !== '0px') paddingMap[p] = (paddingMap[p] || 0) + 1;
            const m = cs.margin;
            if (m && m !== '0px') marginMap[m] = (marginMap[m] || 0) + 1;
            const r = cs.borderRadius;
            if (r && r !== '0px') radiusMap[r] = (radiusMap[r] || 0) + 1;
        });

        function sortMap(map) {
            return Object.entries(map)
                .map(([valor, qtd]) => ({ valor, qtd, hex: rgbToHex(valor) }))
                .sort((a, b) => b.qtd - a.qtd);
        }

        // Componentes
        const botoes = scanBotoes();
        const tabelas = scanTabelas();
        const cards = scanCards();
        const inputs = scanInputs();

        return {
            totalElementos: total,
            cores: {
                backgrounds: sortMap(bgMap),
                textos: sortMap(txtMap),
                bordas: sortMap(bordaMap)
            },
            tipografia: {
                fontes: sortMap(fonteMap),
                tamanhos: sortMap(tamanhoMap),
                pesos: sortMap(pesoMap)
            },
            espacamentos: {
                paddings: sortMap(paddingMap),
                margins: sortMap(marginMap),
                radiuses: sortMap(radiusMap)
            },
            componentes: { botoes, tabelas, cards, inputs }
        };
    }

    function scanBotoes() {
        const btns = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
        const estilos = {};

        btns.forEach(btn => {
            if (isInspetor(btn)) return;
            const rect = btn.getBoundingClientRect();
            if (rect.width === 0) return;
            const cs = window.getComputedStyle(btn);
            const key = `${cs.backgroundColor}|${cs.color}|${cs.borderRadius}|${cs.padding}`;
            if (!estilos[key]) {
                estilos[key] = {
                    bg: cs.backgroundColor,
                    cor: cs.color,
                    radius: cs.borderRadius,
                    padding: cs.padding,
                    exemplo: obterSeletor(btn),
                    qtd: 0
                };
            }
            estilos[key].qtd++;
        });

        return Object.values(estilos).sort((a, b) => b.qtd - a.qtd);
    }

    function scanTabelas() {
        const tabelas = document.querySelectorAll('table');
        return Array.from(tabelas).filter(t => !isInspetor(t)).map(t => {
            const headerRow = t.querySelector('thead tr, tr:first-child');
            const headers = headerRow ? Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.trim()).slice(0, 6) : [];
            const rows = t.querySelectorAll('tbody tr, tr');
            const th = t.querySelector('th');
            const td = t.querySelector('td');
            const thCs = th ? window.getComputedStyle(th) : null;
            const tdCs = td ? window.getComputedStyle(td) : null;

            return {
                seletor: obterSeletor(t),
                colunas: headers.length || (headerRow ? headerRow.children.length : 0),
                linhas: rows.length,
                headers: headers.join(', '),
                headerBg: thCs ? thCs.backgroundColor : '-',
                headerCor: thCs ? thCs.color : '-',
                bodyBg: tdCs ? tdCs.backgroundColor : '-',
                borda: tdCs ? tdCs.border : '-'
            };
        });
    }

    function scanCards() {
        // Detectar elementos que parecem cards (radius + shadow ou radius + bg diferente)
        const candidatos = document.querySelectorAll('div, section, article');
        const estilos = {};

        candidatos.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 30) return;
            const cs = window.getComputedStyle(el);
            const hasShadow = cs.boxShadow !== 'none';
            const hasRadius = cs.borderRadius !== '0px';
            const hasBg = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';

            if ((hasRadius && hasShadow) || (hasRadius && hasBg && rect.width > 100)) {
                const key = `${cs.backgroundColor}|${cs.borderRadius}|${hasShadow}|${cs.padding}`;
                if (!estilos[key]) {
                    estilos[key] = {
                        bg: cs.backgroundColor,
                        radius: cs.borderRadius,
                        shadow: hasShadow,
                        padding: cs.padding,
                        exemplo: obterSeletor(el),
                        qtd: 0
                    };
                }
                estilos[key].qtd++;
            }
        });

        return Object.values(estilos).sort((a, b) => b.qtd - a.qtd);
    }

    function scanInputs() {
        const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="search"], input:not([type]), textarea, select');
        const estilos = {};

        inputs.forEach(inp => {
            if (isInspetor(inp)) return;
            const cs = window.getComputedStyle(inp);
            const key = `${cs.backgroundColor}|${cs.border}|${cs.borderRadius}|${cs.padding}`;
            if (!estilos[key]) {
                estilos[key] = {
                    bg: cs.backgroundColor,
                    borda: cs.border,
                    radius: cs.borderRadius,
                    padding: cs.padding,
                    exemplo: obterSeletor(inp),
                    qtd: 0
                };
            }
            estilos[key].qtd++;
        });

        return Object.values(estilos).sort((a, b) => b.qtd - a.qtd);
    }

    function gerarResumoDesign(scan) {
        let txt = 'DESIGN SYSTEM SCANNER\n\n';

        txt += 'PALETA DE CORES:\n';
        txt += '  Backgrounds: ' + scan.cores.backgrounds.slice(0, 8).map(c => `${c.hex || c.valor} (×${c.qtd})`).join(', ') + '\n';
        txt += '  Textos: ' + scan.cores.textos.slice(0, 6).map(c => `${c.hex || c.valor} (×${c.qtd})`).join(', ') + '\n';
        txt += '  Bordas: ' + scan.cores.bordas.slice(0, 4).map(c => `${c.hex || c.valor} (×${c.qtd})`).join(', ') + '\n';

        txt += '\nTIPOGRAFIA:\n';
        txt += '  Fontes: ' + scan.tipografia.fontes.map(f => `${f.valor} (×${f.qtd})`).join(', ') + '\n';
        txt += '  Tamanhos: ' + scan.tipografia.tamanhos.slice(0, 8).map(t => `${t.valor} (×${t.qtd})`).join(', ') + '\n';
        txt += '  Pesos: ' + scan.tipografia.pesos.map(p => `${p.valor} (×${p.qtd})`).join(', ') + '\n';

        txt += '\nESPAÇAMENTOS:\n';
        txt += '  Paddings: ' + scan.espacamentos.paddings.slice(0, 6).map(p => `${p.valor} (×${p.qtd})`).join(', ') + '\n';
        txt += '  Margins: ' + scan.espacamentos.margins.slice(0, 6).map(m => `${m.valor} (×${m.qtd})`).join(', ') + '\n';
        txt += '  Border-radius: ' + scan.espacamentos.radiuses.slice(0, 4).map(r => `${r.valor} (×${r.qtd})`).join(', ') + '\n';

        txt += '\nCOMPONENTES:\n';
        if (scan.componentes.botoes.length > 0) {
            txt += '  Botões:\n';
            scan.componentes.botoes.slice(0, 3).forEach(b => {
                txt += `    ${b.exemplo} (×${b.qtd}) bg:${b.bg} cor:${b.cor} radius:${b.radius} padding:${b.padding}\n`;
            });
        }
        if (scan.componentes.tabelas.length > 0) {
            txt += '  Tabelas:\n';
            scan.componentes.tabelas.forEach(t => {
                txt += `    ${t.seletor} (${t.colunas}col × ${t.linhas}rows) header-bg:${t.headerBg} | Headers: ${t.headers}\n`;
            });
        }

        return txt;
    }

    // =========================================================
    // TOOL 5: NAVEGAÇÃO
    // =========================================================

    function renderNavegacao() {
        const nav = scanNavegacao();

        let html = `
            <div style="margin-bottom: 12px;">
                <span style="font-size: 11px; color: ${CONFIG.cores.textoMuted}; text-transform: uppercase;">Mapa de Navegação</span>
            </div>
        `;

        // Tabs/abas
        if (nav.tabs.length > 0) {
            let tabsHtml = '';
            nav.tabs.forEach(g => {
                tabsHtml += `<div style="margin-bottom: 8px;">
                    <div style="color:${CONFIG.cores.cyan};font-size:12px;font-weight:600;margin-bottom:4px;">${g.container}</div>`;
                g.items.forEach(item => {
                    const ativoStyle = item.ativo ? `background:${CONFIG.cores.accent};color:white;` : `background:${CONFIG.cores.bg};color:${CONFIG.cores.textoMuted};`;
                    tabsHtml += `<span style="${ativoStyle} padding:3px 10px;border-radius:4px;font-size:11px;margin:2px 3px 2px 0;display:inline-block;">${item.texto}${item.ativo ? ' ●' : ''}</span>`;
                });
                tabsHtml += '</div>';
            });
            html += secao('📑 Abas / Tabs', tabsHtml);
        }

        // Nav menus
        if (nav.menus.length > 0) {
            let menuHtml = '';
            nav.menus.forEach(m => {
                menuHtml += `<div style="margin-bottom: 8px;">
                    <div style="color:${CONFIG.cores.cyan};font-size:12px;font-weight:600;margin-bottom:4px;">${m.container}</div>`;
                m.items.forEach(item => {
                    const ativoStyle = item.ativo ? `color:${CONFIG.cores.verde};` : `color:${CONFIG.cores.texto};`;
                    menuHtml += `<div style="padding:3px 0;font-size:12px;${ativoStyle}">${item.ativo ? '● ' : '  '}${item.texto}${item.href ? ` → ${item.href}` : ''}</div>`;
                });
                menuHtml += '</div>';
            });
            html += secao('🧭 Menus de Navegação', menuHtml);
        }

        // Links internos
        if (nav.links.length > 0) {
            let linksHtml = '<div style="max-height: 200px; overflow-y: auto;">';
            nav.links.slice(0, 20).forEach(l => {
                linksHtml += `<div style="padding:3px 0;font-size:11px;display:flex;justify-content:space-between;">
                    <span style="color:${CONFIG.cores.cyan};word-break:break-all;">${l.texto}</span>
                    <span style="color:${CONFIG.cores.textoMuted};font-size:10px;flex-shrink:0;margin-left:8px;">${l.href}</span>
                </div>`;
            });
            linksHtml += '</div>';
            html += secao(`🔗 Links (${nav.links.length})`, linksHtml);
        }

        // Seções visíveis
        if (nav.secoes.length > 0) {
            let secoesHtml = '';
            nav.secoes.forEach(s => {
                const visStyle = s.visivel ? `color:${CONFIG.cores.verde};` : `color:${CONFIG.cores.textoMuted};text-decoration:line-through;`;
                secoesHtml += `<div style="padding:4px 8px;margin-bottom:3px;background:${CONFIG.cores.bg};border-radius:4px;font-size:11px;${visStyle}">
                    ${s.seletor}${s.titulo ? ` — "${s.titulo}"` : ''} ${s.visivel ? '(visível)' : '(oculta)'}
                </div>`;
            });
            html += secao('📄 Seções da Página', secoesHtml);
        }

        const textoNav = gerarTextoNavegacao(nav);
        html += btnCopiar(textoNav, 'COPIAR MAPA');

        elConteudo.innerHTML = html;
    }

    function scanNavegacao() {
        const resultado = { tabs: [], menus: [], links: [], secoes: [] };

        // Tabs: procurar containers com botões/links que parecem tabs
        const tabContainers = document.querySelectorAll('[role="tablist"], .tabs, .nav-tabs, .tab-bar, .tab-buttons');
        tabContainers.forEach(container => {
            if (isInspetor(container)) return;
            const btns = container.querySelectorAll('button, a, [role="tab"]');
            if (btns.length > 1) {
                resultado.tabs.push({
                    container: obterSeletor(container),
                    items: Array.from(btns).map(btn => ({
                        texto: btn.textContent.trim().substring(0, 30),
                        ativo: btn.classList.contains('active') || btn.getAttribute('aria-selected') === 'true' ||
                               (window.getComputedStyle(btn).backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                                window.getComputedStyle(btn).backgroundColor !== 'transparent')
                    }))
                });
            }
        });

        // Também buscar padrões comuns de tabs sem container específico
        if (resultado.tabs.length === 0) {
            const possiveisTabs = document.querySelectorAll('nav button, header button');
            const groups = new Map();
            possiveisTabs.forEach(btn => {
                if (isInspetor(btn)) return;
                const parent = btn.parentElement;
                if (!groups.has(parent)) groups.set(parent, []);
                groups.get(parent).push(btn);
            });
            groups.forEach((btns, parent) => {
                if (btns.length > 1) {
                    resultado.tabs.push({
                        container: obterSeletor(parent),
                        items: btns.map(btn => ({
                            texto: btn.textContent.trim().substring(0, 30),
                            ativo: btn.classList.contains('active')
                        }))
                    });
                }
            });
        }

        // Menus de navegação
        const navs = document.querySelectorAll('nav, [role="navigation"], .sidebar, .nav-menu, .menu');
        navs.forEach(nav => {
            if (isInspetor(nav)) return;
            const items = nav.querySelectorAll('a, button, .nav-item, .menu-item, .sidebar-item');
            if (items.length > 0) {
                resultado.menus.push({
                    container: obterSeletor(nav),
                    items: Array.from(items).slice(0, 15).map(item => ({
                        texto: item.textContent.trim().substring(0, 40),
                        href: item.href ? item.getAttribute('href') : '',
                        ativo: item.classList.contains('active') || item.classList.contains('selected')
                    }))
                });
            }
        });

        // Links
        const allLinks = document.querySelectorAll('a[href]');
        allLinks.forEach(a => {
            if (isInspetor(a)) return;
            const rect = a.getBoundingClientRect();
            if (rect.width === 0) return;
            resultado.links.push({
                texto: a.textContent.trim().substring(0, 40) || '[sem texto]',
                href: a.getAttribute('href')?.substring(0, 50) || ''
            });
        });

        // Seções
        const secoes = document.querySelectorAll('section, [role="tabpanel"], .panel, .page, .view, .screen');
        secoes.forEach(sec => {
            if (isInspetor(sec)) return;
            const cs = window.getComputedStyle(sec);
            const visivel = cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
            const heading = sec.querySelector('h1, h2, h3, h4, .title');
            resultado.secoes.push({
                seletor: obterSeletor(sec),
                titulo: heading ? heading.textContent.trim().substring(0, 40) : '',
                visivel
            });
        });

        return resultado;
    }

    function gerarTextoNavegacao(nav) {
        let txt = 'MAPA DE NAVEGAÇÃO\n\n';
        if (nav.tabs.length > 0) {
            txt += 'TABS:\n';
            nav.tabs.forEach(g => {
                txt += `  ${g.container}: ${g.items.map(i => i.texto + (i.ativo ? ' [ATIVO]' : '')).join(' | ')}\n`;
            });
        }
        if (nav.menus.length > 0) {
            txt += '\nMENUS:\n';
            nav.menus.forEach(m => {
                txt += `  ${m.container}:\n`;
                m.items.forEach(i => { txt += `    ${i.ativo ? '● ' : '  '}${i.texto}${i.href ? ' → '+i.href : ''}\n`; });
            });
        }
        if (nav.secoes.length > 0) {
            txt += '\nSEÇÕES:\n';
            nav.secoes.forEach(s => {
                txt += `  ${s.seletor}${s.titulo ? ' — "'+s.titulo+'"' : ''} (${s.visivel ? 'visível' : 'oculta'})\n`;
            });
        }
        return txt;
    }

    // =========================================================
    // TOOL 6: HEATMAP
    // =========================================================

    function renderHeatmap() {
        let html = `
            <div style="text-align: center; padding: 20px;">
                <div style="font-size: 48px; margin-bottom: 16px;">🎯</div>
                <h3 style="margin: 0 0 8px; font-size: 16px;">Heatmap Visual</h3>
                <p style="color: ${CONFIG.cores.textoMuted}; font-size: 13px; margin: 0 0 20px;">
                    Colore e numera os principais blocos da página.
                </p>
                <button id="btn-gerar-heatmap" style="
                    background: ${CONFIG.cores.accent}; border: none; color: white;
                    padding: 12px 28px; border-radius: 10px; font-size: 14px; font-weight: 600;
                    cursor: pointer;
                ">Gerar Heatmap</button>
            </div>
        `;

        elConteudo.innerHTML = html;
        document.getElementById('btn-gerar-heatmap').addEventListener('click', gerarHeatmap);
    }

    function gerarHeatmap() {
        limparHeatmap();

        // Minimizar modal para ver a página
        elModal.style.display = 'none';
        elOverlayModal.style.display = 'none';
        elBtnFlutuante.style.display = 'block';
        elBtnFlutuante.textContent = '✕ Fechar Heatmap';
        elBtnFlutuante.style.background = CONFIG.cores.vermelho;
        elBtnFlutuante.style.borderColor = CONFIG.cores.vermelho;
        state.heatmapAtivo = true;

        // Encontrar blocos principais
        const blocos = encontrarBlocosPrincipais();
        const cores = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6','#ec4899','#f43f5e','#14b8a6','#a855f7','#6366f1','#d946ef','#0ea5e9','#84cc16','#f59e0b'];

        const legenda = [];

        blocos.forEach((bloco, i) => {
            const cor = cores[i % cores.length];
            const rect = bloco.el.getBoundingClientRect();

            const overlay = document.createElement('div');
            overlay.className = 'inspetor-heatmap-overlay';
            overlay.style.cssText = `
                position: fixed; z-index: ${CONFIG.zIndex.highlight};
                top: ${rect.top}px; left: ${rect.left}px;
                width: ${rect.width}px; height: ${rect.height}px;
                background: ${cor}22; border: 2px solid ${cor};
                pointer-events: none; display: flex; align-items: flex-start; justify-content: flex-start;
            `;
            overlay.innerHTML = `<span style="
                background: ${cor}; color: white; font-size: 12px; font-weight: 700;
                padding: 2px 8px; border-radius: 0 0 6px 0; font-family: system-ui;
            ">${i + 1}</span>`;

            document.body.appendChild(overlay);
            state.heatmapOverlays.push(overlay);

            legenda.push({
                num: i + 1,
                cor,
                seletor: obterSeletor(bloco.el),
                largura: Math.round(rect.width),
                altura: Math.round(rect.height)
            });
        });

        // Mostrar legenda como toast ou small panel
        const legendaPanel = document.createElement('div');
        legendaPanel.className = 'inspetor-heatmap-overlay';
        legendaPanel.style.cssText = `
            position: fixed; z-index: ${CONFIG.zIndex.modal}; bottom: 70px; right: 20px;
            background: ${CONFIG.cores.bg}; border: 1px solid ${CONFIG.cores.borda};
            border-radius: 12px; padding: 12px; max-height: 50vh; overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4); font-family: system-ui; width: 280px;
        `;
        let legendaHtml = `<div style="font-size:11px;color:${CONFIG.cores.amarelo};text-transform:uppercase;margin-bottom:8px;font-weight:600;">Legenda Heatmap (${legenda.length} blocos)</div>`;
        legenda.forEach(l => {
            legendaHtml += `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;font-size:11px;">
                <span style="background:${l.cor};color:white;width:20px;height:20px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:10px;flex-shrink:0;">${l.num}</span>
                <span style="color:${CONFIG.cores.texto};word-break:break-all;">${l.seletor}</span>
                <span style="color:${CONFIG.cores.textoMuted};flex-shrink:0;">${l.largura}×${l.altura}</span>
            </div>`;
        });
        legendaHtml += `<button onclick="document.getElementById('btn-inspetor-v2').click();" style="
            width:100%;margin-top:10px;padding:8px;background:${CONFIG.cores.accent};border:none;color:white;
            border-radius:6px;font-size:12px;cursor:pointer;font-weight:600;
        ">Voltar ao Mapa UI</button>`;
        legendaPanel.innerHTML = legendaHtml;
        document.body.appendChild(legendaPanel);
        state.heatmapOverlays.push(legendaPanel);

        showToast(`Heatmap: ${legenda.length} blocos mapeados`);
    }

    function encontrarBlocosPrincipais() {
        const candidatos = document.querySelectorAll('header, nav, main, section, article, aside, footer, [role="banner"], [role="main"], [role="contentinfo"]');
        let blocos = [];

        // Primeiro: elementos semânticos
        candidatos.forEach(el => {
            if (isInspetor(el)) return;
            const rect = el.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 30) return;
            if (rect.top > window.innerHeight * 2) return; // Muito abaixo
            blocos.push({ el, area: rect.width * rect.height });
        });

        // Se poucos, adicionar divs grandes com id ou class
        if (blocos.length < 5) {
            const divs = document.querySelectorAll('div[id], div[class]');
            divs.forEach(el => {
                if (isInspetor(el)) return;
                if (blocos.some(b => b.el === el || b.el.contains(el) || el.contains(b.el))) return;
                const rect = el.getBoundingClientRect();
                if (rect.width < 100 || rect.height < 50) return;
                if (rect.top > window.innerHeight * 2) return;
                blocos.push({ el, area: rect.width * rect.height });
            });
        }

        // Remover sobreposições (se um contém o outro, manter o menor)
        blocos.sort((a, b) => a.area - b.area);
        const filtrado = [];
        blocos.forEach(b => {
            const jaContido = filtrado.some(f => f.el.contains(b.el));
            if (!jaContido) filtrado.push(b);
        });

        return filtrado.slice(0, 16).sort((a, b) => {
            const ra = a.el.getBoundingClientRect();
            const rb = b.el.getBoundingClientRect();
            return ra.top - rb.top || ra.left - rb.left;
        });
    }

    function limparHeatmap() {
        state.heatmapOverlays.forEach(el => el.remove());
        state.heatmapOverlays = [];
        state.heatmapAtivo = false;
    }

    // =========================================================
    // INICIALIZAÇÃO
    // =========================================================

    function init() {
        if (!isDesktop()) {
            console.log('Mapa UI v2: Mobile detectado, desativado.');
            return;
        }

        criarBotaoFlutuante();
        criarHighlight();
        criarModal();

        // Fechar com ESC
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape') {
                if (state.inspetorAtivo) {
                    desativarInspetor();
                    abrirModal();
                } else if (state.heatmapAtivo) {
                    limparHeatmap();
                    abrirModal();
                } else if (state.modalAberto) {
                    fecharModal();
                }
            }
        });

        // Interceptar clique no botão flutuante quando heatmap ativo
        const originalToggle = toggleModal;
        elBtnFlutuante.removeEventListener('click', toggleModal);
        elBtnFlutuante.addEventListener('click', () => {
            if (state.inspetorAtivo) {
                desativarInspetor();
                abrirModal();
                renderInspetor();
            } else if (state.heatmapAtivo) {
                limparHeatmap();
                abrirModal();
            } else {
                toggleModal();
            }
        });

        console.log('Mapa UI v2.0 carregado — clique no botão para abrir');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
