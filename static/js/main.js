// Client-side: validation, search, and preview handling
(function(){
  const allowed = ['.pdf', '.docx', '.mp4'];
  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('upload_file');
  const topicInput = document.getElementById('topic');
  const searchBox = document.getElementById('searchBox');
  const table = document.getElementById('filesTable');
  const previewArea = document.getElementById('previewArea');

  if(form){
    // helper to perform AJAX upload with progress for a given File
    function startUpload(file){
      const topic = topicInput.value.trim();
      if(!topic){
        // prompt user to enter topic before uploading
        topicInput.focus();
        const orig = topicInput.value;
        // small inline notice - use alert for now
        alert('Please enter a topic before selecting a file');
        return;
      }
      if(!file){ alert('Please select a file'); return; }
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
          // on success refresh list
          window.location = '/upload';
        }
      };

      xhr.open('POST', form.action);
      xhr.send(fd);
    }

    // intercept submit for compatibility (user can still click Upload)
    form.addEventListener('submit', function(e){
      e.preventDefault();
      startUpload(fileInput.files[0]);
    });

    // start upload immediately when a file is chosen
    fileInput.addEventListener('change', function(e){
      const f = this.files[0];
      if(f) startUpload(f);
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
      if(f) fileInput.files = e.dataTransfer.files;
    });
  }
})();
