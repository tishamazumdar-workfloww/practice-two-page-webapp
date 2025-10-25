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
    form.addEventListener('submit', function(e){
      const file = fileInput.files[0];
      const topic = topicInput.value.trim();
      if(!topic){
        e.preventDefault();
        alert('Topic cannot be empty');
        return;
      }
      if(!file){
        e.preventDefault();
        alert('Please select a file');
        return;
      }
      const name = file.name.toLowerCase();
      const ext = name.substring(name.lastIndexOf('.'));
      if(!allowed.includes(ext)){
        e.preventDefault();
        alert('Invalid file type. Allowed: ' + allowed.join(', '));
        return;
      }
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
})();
