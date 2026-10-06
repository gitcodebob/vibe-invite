// Blokkerend en piepklein, zodat de CSS vóór de eerste paint weet dat JavaScript draait
// (scroll-animaties verbergen dan pas inhoud). Inline kan niet: de CSP staat dat niet toe.
document.documentElement.classList.add('js');
