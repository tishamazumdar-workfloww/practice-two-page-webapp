// Client-side: validation, search, and preview handling
(function(){
  const allowed = ['.pdf', '.docx', '.mp4'];
  const form = document.getElementById('uploadForm');
  let fileInput = document.getElementById('upload_file');
  const topicInput = document.getElementById('topic');
  const searchBox = document.getElementById('searchBox');
  const table = document.getElementById('filesTable');
  const previewArea = document.getElementById('previewArea');

  if(form){
    // helper to perform AJAX upload with progress for a given File
    // pendingFile holds a file selected before topic was entered
    let pendingFile = null;
    function showNotice(msg){
      let n = document.getElementById('uploadNotice');
      if(!n){
        n = document.createElement('div');
        n.id = 'uploadNotice';
        n.style.color = '#b91c1c';
        n.style.marginTop = '8px';
        n.style.fontSize = '13px';
        topicInput.parentNode.appendChild(n);
      }
      n.textContent = msg;
    }
    function clearNotice(){ const n = document.getElementById('uploadNotice'); if(n) n.remove(); }

    function startUpload(file){
      const topic = topicInput.value.trim();
      // upload only when user clicks Upload; validate both fields here
      if(!file){ showNotice('Please select a file before clicking Upload.'); return; }
      if(!topic){ showNotice('Please enter a topic before clicking Upload.'); topicInput.focus(); return; }
      const name = file.name.toLowerCase();
      const ext = name.substring(name.lastIndexOf('.'));
      if(!allowed.includes(ext)){ alert('Invalid file type. Allowed: ' + allowed.join(', ')); return; }

      const fd = new FormData();
      fd.append('topic', topic);
      fd.append('upload_file', file);

      const xhr = new XMLHttpRequest();
      const progressBar = document.getElementById('uploadProgress');
      const progressFill = progressBar ? progressBar.querySelector('span') : null;
      const uploadBtn = form.querySelector('button[type=submit]');
  if(progressBar) progressBar.style.display = 'block';
      if(uploadBtn) uploadBtn.disabled = true;

      xhr.upload.addEventListener('progress', function(ev){
        if(ev.lengthComputable && progressFill){
          const pct = Math.round((ev.loaded / ev.total) * 100);
          progressFill.style.width = pct + '%';
          progressFill.textContent = pct + '%';
        }
      });

      xhr.onreadystatechange = function(){
        if(xhr.readyState === 4){
          const uploadBtn = form.querySelector('button[type=submit]');
          if(xhr.status >= 200 && xhr.status < 300){
            // Try to parse JSON response for AJAX success
            try{
              const resp = JSON.parse(xhr.responseText);
                if(resp && resp.status === 'ok'){
                // show inline success message
                let s = document.getElementById('uploadSuccess');
                if(!s){
                  s = document.createElement('div');
                  s.id = 'uploadSuccess';
                  s.setAttribute('role','status');
                  s.style.color = '#065f46';
                  s.style.marginTop = '8px';
                  s.style.fontSize = '13px';
                  // place success message right after the form (below the upload area)
                  if(form.parentNode){
                    if(form.nextSibling) form.parentNode.insertBefore(s, form.nextSibling);
                    else form.parentNode.appendChild(s);
                  } else {
                    form.appendChild(s);
                  }
                }
                s.textContent = 'Upload complete: ' + (resp.filename || 'file');
                // reset UI
                const progressBar = document.getElementById('uploadProgress');
                const progressFill = progressBar ? progressBar.querySelector('span') : null;
                if(progressBar) progressBar.style.display = 'none';
                if(progressFill) { progressFill.style.width = '0%'; progressFill.textContent = ''; }
                if(uploadBtn) uploadBtn.disabled = false;
                fileInput.value = '';
                pendingFile = null;
                // clear topic and restore drop zone
                topicInput.value = '';
                clearNotice();
                revertDropZone();
                // auto-hide success after 3s
                setTimeout(()=>{ if(s) s.remove(); }, 3000);
                // insert the new file into the top of the files table if present
                try{
                  const tbody = document.querySelector('#filesTable tbody');
                  if(tbody){
                    const tr = document.createElement('tr');
                    const tdName = document.createElement('td');
                    tdName.className = 'fname';
                    tdName.textContent = resp.filename || '';
                    const tdTopic = document.createElement('td');
                    tdTopic.className = 'ftopic';
                    tdTopic.textContent = resp.topic || '';
                    const tdType = document.createElement('td');
                    const spanBadge = document.createElement('span');
                    spanBadge.className = 'dv-badge';
                    spanBadge.textContent = resp.file_type || '';
                    tdType.appendChild(spanBadge);
                    const tdDate = document.createElement('td');
                    tdDate.textContent = resp.upload_date || '';
                    const tdActions = document.createElement('td');
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'dv-actions';
                    if(resp.file_type === 'pdf' || resp.file_type === 'mp4'){
                      const previewBtn = document.createElement('button');
                      previewBtn.className = 'btn-preview preview-btn';
                      previewBtn.setAttribute('data-url', '/files/' + resp.id + '/preview');
                      previewBtn.setAttribute('data-type', resp.file_type === 'pdf' ? 'pdf' : 'mp4');
                      previewBtn.textContent = 'Preview';
                      actionsDiv.appendChild(previewBtn);
                    } else {
                      const noPrev = document.createElement('div');
                      noPrev.className = 'no-preview';
                      noPrev.textContent = 'No preview';
                      actionsDiv.appendChild(noPrev);
                    }
                    const dl = document.createElement('a');
                    dl.className = 'btn-download';
                    dl.href = '/files/' + resp.id + '/download';
                    dl.textContent = 'Download';
                    actionsDiv.appendChild(dl);
                    tdActions.appendChild(actionsDiv);

                    tr.appendChild(tdName);
                    tr.appendChild(tdTopic);
                    tr.appendChild(tdType);
                    tr.appendChild(tdDate);
                    tr.appendChild(tdActions);

                    // prepend to top
                    if(tbody.firstChild) tbody.insertBefore(tr, tbody.firstChild);
                    else tbody.appendChild(tr);
                  }
                }catch(e){ console.warn('Could not auto-insert row', e); }
              } else {
                showNotice('Upload failed (server response)');
                if(uploadBtn) uploadBtn.disabled = false;
              }
            }catch(err){
              // If response not JSON, fallback to full-page refresh
              window.location = '/upload';
            }
          } else {
            showNotice('Upload failed (network/server error)');
            if(uploadBtn) uploadBtn.disabled = false;
            const progressBar = document.getElementById('uploadProgress');
            if(progressBar) progressBar.style.display = 'none';
          }
        }
      };

      xhr.open('POST', form.action);
      try{ xhr.setRequestHeader && xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest'); }catch(e){}
      xhr.send(fd);
    }

    // intercept submit for compatibility (user can still click Upload)
    form.addEventListener('submit', function(e){
      e.preventDefault();
      // prefer pendingFile (set from drag/drop) if fileInput.files may be unavailable
      const toUpload = pendingFile || (fileInput.files && fileInput.files[0]);
      startUpload(toUpload);
    });

    // render a compact file card in the drop zone showing name/size/type
    function humanFileSize(size){
      if(size === 0) return '0 B';
      const i = Math.floor(Math.log(size) / Math.log(1024));
      const sizes = ['B','KB','MB','GB','TB'];
      return (size / Math.pow(1024, i)).toFixed(i?1:0) + ' ' + sizes[i];
    }

    function fileIconForExt(ext){
      if(ext === '.pdf') return '📄';
      if(ext === '.mp4') return '🎬';
      if(ext === '.docx') return '📃';
      return '📁';
    }

    function renderFileCard(file){
      const dz = document.getElementById('dropZone');
      if(!dz) return;
      const name = file.name;
      const size = humanFileSize(file.size);
      const ext = name.substring(name.lastIndexOf('.')).toLowerCase();
      const icon = fileIconForExt(ext);
      dz.classList.add('has-file');
      dz.innerHTML = `
        <div class="dv-file-card">
          <div class="dv-file-meta">
            <div class="dv-file-icon">${icon}</div>
            <div class="dv-file-info">
              <div class="dv-file-name">${name}</div>
              <div class="dv-file-size">${size} · ${ext.replace('.','').toUpperCase()}</div>
            </div>
          </div>
          <div class="dv-file-actions">
            <button type="button" class="dv-change-file">Change file</button>
            <button type="button" class="dv-remove-file">Remove</button>
          </div>
          <input type="file" id="upload_file" name="upload_file" style="display:none" />
        </div>
      `;

      // rebind fileInput to the new hidden input inside the card so change opens native dialog
      const newInput = dz.querySelector('input[type=file]');
      if(newInput){
        fileInput = newInput;
        fileInput.addEventListener('change', function(e){
          const nf = this.files[0];
          if(!nf) return;
          // smooth update: add small updating class then re-render card
          const card = dz.querySelector('.dv-file-card');
          if(card){
            card.classList.add('updating');
            setTimeout(()=>{
              pendingFile = nf;
              renderFileCard(nf);
              clearNotice();
            }, 160);
          } else {
            pendingFile = nf;
            renderFileCard(nf);
            clearNotice();
          }
        });
      }

      // wire buttons
      const changeBtn = dz.querySelector('.dv-change-file');
      const removeBtn = dz.querySelector('.dv-remove-file');
      if(changeBtn) changeBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.click(); });
      if(removeBtn) removeBtn.addEventListener('click', (e) => { e.stopPropagation(); fileInput.value = ''; pendingFile = null; revertDropZone(); clearNotice(); });
    }

    function revertDropZone(){
      const dz = document.getElementById('dropZone');
      if(!dz) return;
      dz.classList.remove('has-file');
      dz.innerHTML = `
        <div><span class="choose">Choose file</span> or drag and drop</div>
        <div class="hint">Supported: PDF, DOCX, MP4</div>
        <input type="file" id="upload_file" name="upload_file" style="display:none" />
      `;
      // reattach fileInput reference to the new input element
      const newInput = dz.querySelector('input[type=file]');
      if(newInput){
        // replace fileInput element reference and wire change
        fileInput = newInput;
        fileInput.addEventListener('change', function(e){
          const f = this.files[0];
          pendingFile = f || null;
          clearNotice();
          if(!f) return;
          if(!topicInput.value.trim()){
            showNotice('Topic is empty — enter a topic and click Upload to start.');
          } else {
            showNotice('File selected. Click Upload to start.');
          }
        });
        // re-wire drop zone click
        dz.addEventListener('click', () => fileInput.click());
      }
    }

    // when a file is chosen, remember it but do NOT start upload; user must click Upload
    fileInput.addEventListener('change', function(e){
      const f = this.files[0];
      pendingFile = f || null;
      clearNotice();
      if(!f) { revertDropZone(); return; }
      renderFileCard(f);
      if(!topicInput.value.trim()){
        showNotice('Topic is empty — enter a topic and click Upload to start.');
      } else {
        showNotice('File selected. Click Upload to start.');
      }
    });

    // when topic is typed, just clear notices; do not auto-start upload
    topicInput.addEventListener('input', function(){
      if(this.value.trim()) clearNotice();
    });
  }

  // search/filter
  if(searchBox){
    searchBox.addEventListener('input', function(){
      const q = this.value.toLowerCase();
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(r => {
        const fname = r.querySelector('.fname').textContent.toLowerCase();
        const ftopic = r.querySelector('.ftopic').textContent.toLowerCase();
        if(fname.includes(q) || ftopic.includes(q)) r.style.display = '';
        else r.style.display = 'none';
      });
    });
  }

  // preview
  document.addEventListener('click', function(e){
    const btn = e.target.closest('.preview-btn');
    if(!btn) return;
    e.preventDefault();
    const url = btn.getAttribute('data-url');
    const type = btn.getAttribute('data-type');
    previewArea.innerHTML = '';
    if(type === 'pdf'){
      const iframe = document.createElement('iframe');
      iframe.src = url;
      iframe.style.width = '100%';
      iframe.style.height = '480px';
      previewArea.appendChild(iframe);
      window.scrollTo({ top: iframe.offsetTop - 20, behavior: 'smooth' });
    } else if(type === 'mp4'){
      const video = document.createElement('video');
      video.src = url;
      video.controls = true;
      video.style.maxHeight = '480px';
      previewArea.appendChild(video);
      window.scrollTo({ top: video.offsetTop - 20, behavior: 'smooth' });
    }
  });

  // drag and drop
  const dropZone = document.getElementById('dropZone');
  if(dropZone){
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault(); dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if(f){
        // assign files and render
        try{ fileInput.files = e.dataTransfer.files; }catch(err){ /* some browsers restrict setting files */ }
        pendingFile = f;
        renderFileCard(f);
        if(!topicInput.value.trim()) showNotice('Topic is empty — enter a topic and click Upload to start.');
        else showNotice('File selected. Click Upload to start.');
      }
    });
  }
})();
