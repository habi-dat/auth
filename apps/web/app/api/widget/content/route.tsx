import { getSession } from '@habidat/auth/session'
import { prisma } from '@habidat/db'
import { NextResponse } from 'next/server'
import { getUserApps } from '@/lib/actions/app-actions'
import { getGeneralSettings } from '@/lib/settings/general'

interface AppInfo {
  id: string
  name: string
  url: string
  description?: string | null
  iconUrl?: string | null
  logoUrl?: string | null
  useIconAsLogo?: boolean
}

function renderWidgetHtml(apps: AppInfo[], logoUrl?: string | null, title?: string | null) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const absoluteLogoUrl = logoUrl
    ? logoUrl.startsWith('http')
      ? logoUrl
      : `${baseUrl}${logoUrl}`
    : null

  return `
    <div class="widget-container">
      <div class="app-menu" id="habidat-app-menu">
        <div class="app-menu-header">${title || 'SSO Apps'}</div>
        <ul class="app-list">
          ${apps
            .map(
              (app) => `
            <li class="app-item">
              <a href="${app.url}" class="app-link">
                ${
                  app.useIconAsLogo && app.iconUrl
                    ? `<img src="${
                        app.iconUrl.startsWith('http') ? app.iconUrl : `${baseUrl}${app.iconUrl}`
                      }" alt="${app.name}" class="app-icon" />`
                    : app.logoUrl
                      ? `<img src="${
                          app.logoUrl.startsWith('http') ? app.logoUrl : `${baseUrl}${app.logoUrl}`
                        }" alt="${app.name}" class="app-icon" style="object-fit: contain;" />`
                      : `<div class="app-icon">${app.name.charAt(0).toUpperCase()}</div>`
                }
                <div class="app-info">
                  <span class="app-name">${app.name}</span>
                  ${app.description ? `<span class="app-desc">${app.description}</span>` : ''}
                </div>
              </a>
            </li>
          `
            )
            .join('')}
        </ul>
      </div>
      <button type="button" class="menu-button ${absoluteLogoUrl ? 'has-logo' : ''}" id="habidat-menu-button" aria-label="Toggle App Menu">
        ${
          absoluteLogoUrl
            ? `<img src="${absoluteLogoUrl}" alt="Menu" />`
            : `<svg viewBox="0 0 24 24" aria-hidden="true">
                <title>Toggle App Menu</title>
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
              </svg>`
        }
      </button>
    </div>
  `
}

export async function GET() {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  }

  try {
    const sessionData = await getSession()
    if (!sessionData?.session) {
      return NextResponse.json({ html: '', css: '' }, { headers })
    }

    const user = await prisma.user.findUnique({
      where: { id: sessionData.session.userId },
      include: {
        memberships: { select: { groupId: true } },
      },
    })

    if (!user) {
      return NextResponse.json({ html: '', css: '' }, { headers })
    }

    const userGroupIds = user.memberships.map((m) => m.groupId)
    const apps = await getUserApps(userGroupIds)

    if (!apps || apps.length === 0) {
      return NextResponse.json({ html: '', css: '' }, { headers })
    }

    const settings = await getGeneralSettings()

    // We use themeColor from settings or default Habidat blue
    const themeColor = settings.themeColor || '#0088cc'

    const html = renderWidgetHtml(apps, settings.logoUrl, settings.platformName)

    const css = `
      :host {
        --primary: ${themeColor};
        --bg: #ffffff;
        --text: #333333;
        --border: #e2e8f0;
        --hover: #f1f5f9;
        --shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        --radius: 12px;
        font-family: system-ui, -apple-system, sans-serif;
      }

      .widget-container {
        position: fixed;
        bottom: 24px;
        right: 24px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
      }

      .menu-button {
        background-color: var(--primary);
        color: white;
        border: none;
        border-radius: 50%;
        width: 56px;
        height: 56px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: var(--shadow);
        transition: transform 0.2s, background-color 0.2s;
        z-index: 2;
      }
      
      .menu-button:hover {
        transform: scale(1.05);
        filter: brightness(1.1);
      }

      .menu-button svg {
        width: 28px;
        height: 28px;
        fill: currentColor;
      }
      
      .menu-button.has-logo {
        background-color: transparent;
        box-shadow: none;
        width: 112px;
        height: 112px;
        border-radius: 0;
        padding: 0;
      }

      .menu-button.has-logo img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.25));
      }

      @media (prefers-color-scheme: dark) {
        .menu-button.has-logo img {
          filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
        }
      }

      .app-menu {
        position: absolute;
        bottom: calc(100% + 16px);
        right: 0;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: var(--radius);
        width: 240px;
        max-height: 480px;
        overflow-y: auto;
        box-shadow: var(--shadow);
        opacity: 0;
        visibility: hidden;
        transform: translateY(10px);
        transition: opacity 0.3s, transform 0.3s, visibility 0.3s;
        z-index: 1;
      }

      .app-menu.open {
        opacity: 1;
        visibility: visible;
        transform: translateY(0);
      }

      .app-menu-header {
        padding: 16px;
        border-bottom: 1px solid var(--border);
        font-weight: 600;
        font-size: 16px;
        color: var(--text);
        background: var(--bg);
        position: sticky;
        top: 0;
        z-index: 2;
        border-radius: var(--radius) var(--radius) 0 0;
      }

      .app-list {
        list-style: none;
        margin: 0;
        padding: 8px;
      }

      .app-item {
        margin-bottom: 4px;
      }

      .app-link {
        display: flex;
        align-items: center;
        padding: 6px;
        text-decoration: none;
        color: var(--text);
        border-radius: 8px;
        transition: background-color 0.2s;
      }

      .app-link:hover {
        background-color: var(--hover);
      }

      .app-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        margin-right: 16px;
        object-fit: cover;
        background-color: var(--hover);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        font-size: 18px;
        color: var(--primary);
        flex-shrink: 0;
      }
      
      .app-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      
      .app-name {
        font-weight: 500;
        font-size: 14px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .app-desc {
        font-size: 12px;
        color: #64748b;
        margin-top: 4px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      /* Scrollbar styling */
      .app-menu::-webkit-scrollbar {
        width: 6px;
      }
      .app-menu::-webkit-scrollbar-track {
        background: transparent;
      }
      .app-menu::-webkit-scrollbar-thumb {
        background: #cbd5e1;
        border-radius: 3px;
      }
      .app-menu::-webkit-scrollbar-thumb:hover {
        background: #94a3b8;
      }
    `

    return NextResponse.json({ html, css }, { headers })
  } catch (error) {
    console.error('Error generating widget content:', error)
    return NextResponse.json({ html: '', css: '' }, { headers, status: 500 })
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      },
    }
  )
}
