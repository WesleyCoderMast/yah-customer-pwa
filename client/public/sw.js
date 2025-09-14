const CACHE_NAME = 'yah-customer-v1.0.0';
const STATIC_CACHE = 'yah-static-v1';
const DYNAMIC_CACHE = 'yah-dynamic-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/src/main.tsx',
  '/src/index.css',
  '/manifest.json',
  // Add critical CSS and JS files
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// API endpoints to cache
const API_ENDPOINTS = [
  '/api/auth/user',
  '/api/payment-methods',
  '/api/rides',
  '/api/saved-locations'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),
      // Cache API endpoints for offline access
      caches.open(DYNAMIC_CACHE).then((cache) => {
        console.log('[SW] Pre-caching API endpoints');
        return Promise.allSettled(
          API_ENDPOINTS.map(endpoint => 
            fetch(endpoint)
              .then(response => response.ok ? cache.put(endpoint, response) : null)
              .catch(() => null) // Ignore errors for endpoints that require auth
          )
        );
      })
    ]).then(() => {
      console.log('[SW] Service worker installed successfully');
      // Force activation of new service worker
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (![STATIC_CACHE, DYNAMIC_CACHE, CACHE_NAME].includes(cacheName)) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients
      self.clients.claim()
    ]).then(() => {
      console.log('[SW] Service worker activated successfully');
    })
  );
});

// Fetch event - implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }

  // Handle different types of requests with appropriate strategies
  if (url.pathname.startsWith('/api/')) {
    // API requests - Network first with cache fallback
    event.respondWith(networkFirstStrategy(request));
  } else if (isStaticAsset(url)) {
    // Static assets - Cache first
    event.respondWith(cacheFirstStrategy(request));
  } else {
    // Navigation requests - Network first for HTML
    event.respondWith(networkFirstStrategy(request));
  }
});

// Network first strategy (for API calls and navigation)
async function networkFirstStrategy(request) {
  try {
    // Try network first
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request.url, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // If it's a navigation request and cache fails, return offline page
    if (request.destination === 'document') {
      return createOfflineResponse();
    }
    
    throw error;
  }
}

// Cache first strategy (for static assets)
async function cacheFirstStrategy(request) {
  // Try cache first
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    // Cache miss, try network
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request.url, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('[SW] Failed to fetch:', request.url);
    throw error;
  }
}

// Check if URL is a static asset
function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.ico') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com' ||
    url.hostname === 'cdnjs.cloudflare.com'
  );
}

// Create offline fallback response
function createOfflineResponse() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Yah™ Customer - Offline</title>
      <style>
        body {
          font-family: 'Inter', sans-serif;
          background: linear-gradient(135deg, #1A1A1A 0%, #2D2D2D 100%);
          color: white;
          margin: 0;
          padding: 0;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .container {
          text-align: center;
          padding: 2rem;
        }
        .icon {
          font-size: 4rem;
          color: #D4AF37;
          margin-bottom: 2rem;
        }
        h1 {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: #D4AF37;
        }
        p {
          color: #ccc;
          margin-bottom: 2rem;
        }
        .retry-btn {
          background: linear-gradient(135deg, #FFD700 0%, #D4AF37 100%);
          color: #1A1A1A;
          border: none;
          padding: 1rem 2rem;
          border-radius: 1rem;
          font-weight: bold;
          cursor: pointer;
          font-size: 1rem;
        }
        .retry-btn:hover {
          opacity: 0.9;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">👑</div>
        <h1>You're Offline</h1>
        <p>Please check your internet connection and try again.</p>
        <button class="retry-btn" onclick="window.location.reload()">
          Try Again
        </button>
      </div>
    </body>
    </html>`,
    {
      headers: { 'Content-Type': 'text/html' },
      status: 200,
      statusText: 'OK'
    }
  );
}

// Background sync for ride updates
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-ride-updates') {
    event.waitUntil(syncRideUpdates());
  } else if (event.tag === 'sync-chat-messages') {
    event.waitUntil(syncChatMessages());
  }
});

// Sync ride updates when online
async function syncRideUpdates() {
  try {
    // Get pending ride updates from IndexedDB or localStorage
    const pendingUpdates = JSON.parse(localStorage.getItem('pendingRideUpdates') || '[]');
    
    for (const update of pendingUpdates) {
      try {
        const response = await fetch(`/api/rides/${update.rideId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(update.data)
        });
        
        if (response.ok) {
          // Remove from pending updates
          const remaining = pendingUpdates.filter(u => u.id !== update.id);
          localStorage.setItem('pendingRideUpdates', JSON.stringify(remaining));
        }
      } catch (error) {
        console.log('[SW] Failed to sync ride update:', error);
      }
    }
  } catch (error) {
    console.log('[SW] Background sync failed:', error);
  }
}

// Sync chat messages when online
async function syncChatMessages() {
  try {
    const pendingMessages = JSON.parse(localStorage.getItem('pendingChatMessages') || '[]');
    
    for (const message of pendingMessages) {
      try {
        const response = await fetch('/api/chat/message', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message.data)
        });
        
        if (response.ok) {
          const remaining = pendingMessages.filter(m => m.id !== message.id);
          localStorage.setItem('pendingChatMessages', JSON.stringify(remaining));
        }
      } catch (error) {
        console.log('[SW] Failed to sync chat message:', error);
      }
    }
  } catch (error) {
    console.log('[SW] Chat sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'You have a new notification from Yah™',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: data.tag || 'yah-notification',
      data: data.data || {},
      actions: data.actions || [],
      vibrate: [100, 50, 100],
      requireInteraction: data.requireInteraction || false,
      silent: false
    };
    
    event.waitUntil(
      self.registration.showNotification(
        data.title || 'Yah™ Customer',
        options
      )
    );
  } catch (error) {
    console.log('[SW] Push notification error:', error);
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  // Route to appropriate page based on notification type
  if (data.rideId) {
    url = `/ride/${data.rideId}`;
  } else if (data.type === 'chat') {
    url = '/chat';
  } else if (data.type === 'payment') {
    url = '/payment';
  }
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clientList) => {
      // Try to focus existing window
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed');
  
  // Track notification dismissal
  const data = event.notification.data;
  if (data.trackDismissal) {
    fetch('/api/analytics/notification-dismissed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationId: data.id,
        timestamp: Date.now()
      })
    }).catch(() => {
      // Ignore analytics errors
    });
  }
});

// Handle messages from the main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  } else if (event.data.type === 'CACHE_RIDE_DATA') {
    // Cache specific ride data for offline access
    caches.open(DYNAMIC_CACHE).then(cache => {
      cache.put(
        `/api/rides/${event.data.rideId}`,
        new Response(JSON.stringify(event.data.rideData), {
          headers: { 'Content-Type': 'application/json' }
        })
      );
    });
  }
});

console.log('[SW] Yah™ Customer Service Worker loaded successfully');
