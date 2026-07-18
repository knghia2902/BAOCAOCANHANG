(function() {
    // If already initialized on this tab, just toggle panel visibility
    if (window.__layoutRulerPanel) {
        if (window.__layoutRulerPanel.classList.contains('layout-ruler-hidden')) {
            window.__layoutRulerPanel.classList.remove('layout-ruler-hidden');
        } else {
            window.__layoutRulerPanel.classList.add('layout-ruler-hidden');
            // Disable inspect mode when hiding panel
            if (window.__layoutRulerIsInspecting) {
                window.__layoutRulerToggleInspect();
            }
        }
        return;
    }

    // STATE VARIABLES
    window.__layoutRulerIsInspecting = false;
    window.__layoutRulerShowOutlines = false;
    window.__layoutRulerShowGrid = false;
    let hoveredElement = null;

    // CREATE UI PANEL
    const panel = document.createElement('div');
    panel.className = 'layout-ruler-panel';
    window.__layoutRulerPanel = panel;

    // Header
    const header = document.createElement('div');
    header.className = 'layout-ruler-header';
    
    const title = document.createElement('span');
    title.className = 'layout-ruler-title';
    title.innerHTML = '📏 Thước Đo Thiết Kế';
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'layout-ruler-close';
    closeBtn.innerHTML = '✕';
    closeBtn.addEventListener('click', () => {
        panel.classList.add('layout-ruler-hidden');
        if (window.__layoutRulerIsInspecting) window.__layoutRulerToggleInspect();
    });

    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    // Inspector Button
    const inspectBtn = document.createElement('button');
    inspectBtn.className = 'layout-ruler-btn layout-ruler-btn-inactive';
    inspectBtn.innerHTML = '🎯 Soi chi tiết (Hover)';
    
    // Outlines Button
    const outlinesBtn = document.createElement('button');
    outlinesBtn.className = 'layout-ruler-btn layout-ruler-btn-inactive';
    outlinesBtn.innerHTML = '🔲 Hiện khung viền';

    // Grid Button
    const gridBtn = document.createElement('button');
    gridBtn.className = 'layout-ruler-btn layout-ruler-btn-inactive';
    gridBtn.innerHTML = '📊 Hiện lưới 12 cột';

    // Guide Text
    const guide = document.createElement('div');
    guide.className = 'layout-ruler-guide';
    guide.innerHTML = '* Di chuột vào bất cứ phần tử nào để xem kích thước, padding và margin. Bấm ESC để tắt chế độ soi.';

    panel.appendChild(inspectBtn);
    panel.appendChild(outlinesBtn);
    panel.appendChild(gridBtn);
    panel.appendChild(guide);
    document.body.appendChild(panel);

    // TOOLTIP FOR INSPECT MODE
    const tooltip = document.createElement('div');
    tooltip.className = 'layout-ruler-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // GRID OVERLAY ELEMENT
    let gridOverlay = null;

    // TOGGLE FUNCTIONS
    window.__layoutRulerToggleInspect = function() {
        window.__layoutRulerIsInspecting = !window.__layoutRulerIsInspecting;
        if (window.__layoutRulerIsInspecting) {
            inspectBtn.className = 'layout-ruler-btn layout-ruler-btn-active';
            inspectBtn.innerHTML = '🎯 Đang soi bố cục';
            document.body.style.cursor = 'crosshair';
        } else {
            inspectBtn.className = 'layout-ruler-btn layout-ruler-btn-inactive';
            inspectBtn.innerHTML = '🎯 Soi chi tiết (Hover)';
            document.body.style.cursor = 'default';
            tooltip.style.display = 'none';
            hoveredElement = null;
        }
    };

    const toggleOutlines = () => {
        window.__layoutRulerShowOutlines = !window.__layoutRulerShowOutlines;
        if (window.__layoutRulerShowOutlines) {
            outlinesBtn.className = 'layout-ruler-btn layout-ruler-btn-active';
            outlinesBtn.innerHTML = '🔲 Ẩn khung viền';
            document.body.classList.add('layout-ruler-outlines');
        } else {
            outlinesBtn.className = 'layout-ruler-btn layout-ruler-btn-inactive';
            outlinesBtn.innerHTML = '🔲 Hiện khung viền';
            document.body.classList.remove('layout-ruler-outlines');
        }
    };

    const toggleGrid = () => {
        window.__layoutRulerShowGrid = !window.__layoutRulerShowGrid;
        if (window.__layoutRulerShowGrid) {
            gridBtn.className = 'layout-ruler-btn layout-ruler-btn-active';
            gridBtn.innerHTML = '📊 Ẩn lưới 12 cột';
            
            gridOverlay = document.createElement('div');
            gridOverlay.className = 'layout-ruler-grid';
            for (let i = 0; i < 12; i++) {
                const col = document.createElement('div');
                col.className = 'layout-ruler-grid-col';
                gridOverlay.appendChild(col);
            }
            document.body.appendChild(gridOverlay);
        } else {
            gridBtn.className = 'layout-ruler-btn layout-ruler-btn-inactive';
            gridBtn.innerHTML = '📊 Hiện lưới 12 cột';
            if (gridOverlay) {
                gridOverlay.remove();
                gridOverlay = null;
            }
        }
    };

    // Button event listeners
    inspectBtn.addEventListener('click', window.__layoutRulerToggleInspect);
    outlinesBtn.addEventListener('click', toggleOutlines);
    gridBtn.addEventListener('click', toggleGrid);

    // MOUSE MOVE FOR INSPECT
    document.addEventListener('mousemove', (e) => {
        if (!window.__layoutRulerIsInspecting) return;

        const target = e.target;
        if (!target || target.closest('.layout-ruler-panel') || target.closest('.layout-ruler-tooltip') || target.closest('.layout-ruler-grid')) {
            tooltip.style.display = 'none';
            hoveredElement = null;
            return;
        }

        hoveredElement = target;
        const rect = target.getBoundingClientRect();
        const style = window.getComputedStyle(target);

        const w = Math.round(rect.width);
        const h = Math.round(rect.height);
        const padding = `${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft}`;
        const margin = `${style.marginTop} ${style.marginRight} ${style.marginBottom} ${style.marginLeft}`;
        const fontSize = style.fontSize;
        const borderRadius = style.borderRadius;

        const classes = Array.from(target.classList)
            .filter(c => !c.includes('v-') && !c.includes('data-v'))
            .slice(0, 5)
            .join(' ');

        tooltip.innerHTML = `
            <strong>&lt;${target.tagName.toLowerCase()}&gt;</strong> ${classes ? '.' + classes.replace(/ /g, '.') : ''}<br/>
            📐 Kích thước: <strong>${w}px × ${h}px</strong><br/>
            📦 Padding: ${padding.replace(/px/g, '')}<br/>
            🚚 Margin: ${margin.replace(/px/g, '')}<br/>
            🔤 Font size: ${fontSize} | Bo góc: ${borderRadius}
        `;

        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 15}px`;
        tooltip.style.top = `${e.clientY + 15}px`;
    });

    // ESC KEY TO CLOSE INSPECT MODE
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && window.__layoutRulerIsInspecting) {
            window.__layoutRulerToggleInspect();
        }
    });

    // Global toggle hook (called if reinjected)
    window.__layoutRulerToggle = function() {
        if (panel.classList.contains('layout-ruler-hidden')) {
            panel.classList.remove('layout-ruler-hidden');
        } else {
            panel.classList.add('layout-ruler-hidden');
            if (window.__layoutRulerIsInspecting) window.__layoutRulerToggleInspect();
        }
    };
})();
