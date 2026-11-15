const { PDFDocument } = PDFLib;
      let selectedPdfFiles = [];
      let draggedPdfIndex = null;

      function renderPdfMergeList() {
        const fileListContainer = document.getElementById('pdfMergeFileList');
        const fileList = document.getElementById('pdfMergeList');

        if (!selectedPdfFiles.length) {
          fileListContainer.style.display = 'none';
          fileList.innerHTML = '';
          return;
        }

        fileList.innerHTML = selectedPdfFiles.map((file, index) => `
          <div class="pdf-merge-item" draggable="true" data-index="${index}" aria-label="${file.name}">
            <div class="pdf-merge-preview">
              <canvas data-pdf-preview="${index}"></canvas>
            </div>
            <div class="pdf-merge-meta">
              <div class="pdf-merge-order">#${index + 1}</div>
              <div class="pdf-merge-name">${file.name}</div>
              <div class="pdf-merge-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
            <div class="pdf-item-actions">
              <button type="button" data-move="up" data-index="${index}">⬆ 上移</button>
              <button type="button" data-move="down" data-index="${index}">⬇ 下移</button>
              <button type="button" class="delete-pdf-btn" data-delete-index="${index}">移除</button>
            </div>
          </div>
        `).join('');

        fileListContainer.style.display = 'block';

        selectedPdfFiles.forEach((file, index) => {
          const canvas = fileList.querySelector(`canvas[data-pdf-preview="${index}"]`);
          if (!canvas) return;
          renderPdfThumbnail(file, canvas);
        });

        fileList.querySelectorAll('.pdf-merge-item').forEach(item => {
          item.addEventListener('click', () => {
            const selectedIndex = Number(item.dataset.index);
            fileList.querySelectorAll('.pdf-merge-item').forEach(node => node.classList.remove('selected'));
            item.classList.add('selected');
            item.setAttribute('data-selected-index', String(selectedIndex));
          });

          item.addEventListener('dragstart', (event) => {
            draggedPdfIndex = Number(item.dataset.index);
            item.classList.add('dragging');
            event.dataTransfer.effectAllowed = 'move';
          });

          item.addEventListener('dragover', (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'move';
          });

          item.addEventListener('drop', (event) => {
            event.preventDefault();
            const targetIndex = Number(item.dataset.index);
            if (draggedPdfIndex === null || targetIndex === draggedPdfIndex) return;

            const [moved] = selectedPdfFiles.splice(draggedPdfIndex, 1);
            selectedPdfFiles.splice(targetIndex, 0, moved);
            renderPdfMergeList();
            draggedPdfIndex = null;
          });

          item.addEventListener('dragend', () => {
            draggedPdfIndex = null;
            item.classList.remove('dragging');
          });
        });

        const firstItem = fileList.querySelector('.pdf-merge-item');
        if (firstItem) {
          firstItem.classList.add('selected');
          firstItem.setAttribute('data-selected-index', '0');
        }

        fileList.querySelectorAll('.delete-pdf-btn').forEach(button => {
          button.addEventListener('click', () => {
            const deleteIndex = Number(button.dataset.deleteIndex);
            selectedPdfFiles.splice(deleteIndex, 1);
            renderPdfMergeList();
          });
        });

        fileList.querySelectorAll('[data-move]').forEach(button => {
          button.addEventListener('click', () => {
            const moveIndex = Number(button.dataset.index);
            const direction = button.dataset.move === 'up' ? -1 : 1;
            const targetIndex = moveIndex + direction;
            if (targetIndex < 0 || targetIndex >= selectedPdfFiles.length) return;

            const [moved] = selectedPdfFiles.splice(moveIndex, 1);
            selectedPdfFiles.splice(targetIndex, 0, moved);
            renderPdfMergeList();
          });
        });
      }

      async function renderPdfThumbnail(file, canvas) {
        if (!window.pdfjsLib) {
          canvas.parentElement.innerHTML = '<div class="pdf-merge-preview-fallback">PDF 預覽</div>';
          return;
        }

        try {
          if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.15.349/pdf.worker.min.js';
          }

          const buffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.9 });
          const context = canvas.getContext('2d');

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport }).promise;
        } catch (error) {
          canvas.parentElement.innerHTML = '<div class="pdf-merge-preview-fallback">PDF 預覽</div>';
        }
      }

      function getSelectedPdfMergeFiles() {
        const input = document.getElementById('pdfMergeFiles');
        return Array.from(input?.files || []);
      }

      function addPdfFiles(newFiles) {
        const validFiles = newFiles.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
        if (!validFiles.length) {
          alert('請選擇有效的 PDF 檔案。');
          return;
        }

        selectedPdfFiles = [...selectedPdfFiles, ...validFiles];
        renderPdfMergeList();
      }

      document.getElementById('pdfMergeFiles')?.addEventListener('change', function () {
        const files = getSelectedPdfMergeFiles();
        const validFiles = files.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
        selectedPdfFiles = validFiles;
        renderPdfMergeList();
      });

      document.getElementById('pdfMergeAddFiles')?.addEventListener('change', function () {
        addPdfFiles(Array.from(this.files || []));
        this.value = '';
      });

      async function mergePdfFiles() {
        const resultBox = document.getElementById('pdfMergeResult');
        const output = document.getElementById('pdfMergeOutput');

        if (!selectedPdfFiles.length) {
          alert('請先選擇至少一個 PDF 檔案。');
          return;
        }

        try {
          const mergedPdf = await PDFDocument.create();

          for (const file of selectedPdfFiles) {
            const fileBytes = await file.arrayBuffer();
            const sourcePdf = await PDFDocument.load(fileBytes);
            const pageCount = sourcePdf.getPageCount();
            if (pageCount === 0) {
              throw new Error(`檔案 ${file.name} 不包含任何頁面。`);
            }

            const copiedPages = await mergedPdf.copyPages(sourcePdf, sourcePdf.getPageIndices());
            copiedPages.forEach(page => mergedPdf.addPage(page));
          }

          const mergedBytes = await mergedPdf.save();
          const blob = new Blob([mergedBytes], { type: 'application/pdf' });
          const link = document.createElement('a');
          const fileName = selectedPdfFiles.length > 1 ? 'merged-pdf.pdf' : `${selectedPdfFiles[0].name.replace(/\.pdf$/i, '')}-merged.pdf`;

          link.href = URL.createObjectURL(blob);
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();

          output.innerHTML = `
            <div class="result-item"><strong>成功合併 ${selectedPdfFiles.length} 個 PDF 檔案。</strong></div>
            <div class="result-item">檔案名稱：${fileName}</div>
            <div class="result-item">已依目前排序完成合併，並自動下載。</div>
          `;
          resultBox.style.display = 'block';
        } catch (error) {
          output.innerHTML = `<div class="result-item" style="color: #c0392b;"><strong>合併失敗：</strong> ${error.message || '請確認檔案格式正確。'}</div>`;
          resultBox.style.display = 'block';
        }
      }
