theme.gwp = require('./gwp.js');

document.addEventListener('page:loaded', function() {
  // Page has loaded and theme assets are ready
  theme.sections.register('header', theme.gwp);
});
