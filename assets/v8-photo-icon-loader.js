// v8 photo icons: apply only when the 2×3 photo sprite actually loads.
// The six launchers are moved into .app-home-shell by v5-app-home.js.
if (document.body.dataset.page === 'home') {
  const image = new Image();
  image.onload = () => {
    if (image.naturalWidth > 0) document.documentElement.classList.add('photo-icons-ready');
  };
  image.onerror = () => {
    document.documentElement.classList.remove('photo-icons-ready');
  };
  image.src = '/assets/activity-photo-sprite-v7.webp?v=20261118-v8';
}
