import { NextResponse } from 'next/server'

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  const scriptContent = `
(function() {
  // Prevent multiple injections
  if (document.getElementById('habidat-sso-widget')) return;

  const baseUrl = '${baseUrl}';

  const container = document.createElement('div');
  container.id = 'habidat-sso-widget';
  
  // Create a Shadow DOM to encapsulate our styles and markup
  const shadow = container.attachShadow({ mode: 'open' });
  document.body.appendChild(container);

  // Fetch widget content from the host's API route
  // "credentials: 'include'" ensures the session cookie is sent if we are on the same domain or a subdomain
  fetch(baseUrl + '/api/widget/content', { credentials: 'include' })
    .then(res => {
      if (!res.ok) throw new Error('Network response was not ok');
      return res.json();
    })
    .then(data => {
      // If no HTML is returned, the user is likely not logged in or has no apps
      if (!data.html || !data.css) return;
      
      const style = document.createElement('style');
      style.textContent = data.css;
      
      const wrapper = document.createElement('div');
      wrapper.innerHTML = data.html;
      
      shadow.appendChild(style);
      shadow.appendChild(wrapper);

      // Add interactivity to the floating button
      const button = shadow.getElementById('habidat-menu-button');
      const menu = shadow.getElementById('habidat-app-menu');
      
      if (button && menu) {
        button.addEventListener('click', () => {
          menu.classList.toggle('open');
        });

        // Close when clicking outside of the widget container
        document.addEventListener('click', (e) => {
          if (!container.contains(e.target)) {
            menu.classList.remove('open');
          }
        });
      }
    })
    .catch(err => {
      console.error('Failed to load Habidat SSO widget:', err);
    });
})();
  `

  return new NextResponse(scriptContent, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
