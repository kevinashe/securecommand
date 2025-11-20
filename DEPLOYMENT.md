# Deployment Guide for SecureCommand

This guide will help you deploy your SecureCommand application to the web.

## Option 1: Deploy to Netlify (Recommended - Easiest)

### Method A: Drag & Drop (No Git Required)

1. **Build your project locally:**
   ```bash
   npm run build
   ```

2. **Go to Netlify:**
   - Visit https://app.netlify.com/drop
   - Create a free account if you don't have one

3. **Deploy:**
   - Drag and drop the entire `dist` folder to the Netlify Drop page
   - Your site will be live in seconds!
   - Netlify will give you a URL like: `https://random-name.netlify.app`

4. **Custom Domain (Optional):**
   - Go to Site Settings > Domain Management
   - Add your custom domain
   - Follow the DNS instructions

### Method B: Connect to Git (Automatic Deployments)

1. **Push your code to GitHub:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin YOUR_GITHUB_REPO_URL
   git push -u origin main
   ```

2. **Connect to Netlify:**
   - Go to https://app.netlify.com
   - Click "Add new site" > "Import an existing project"
   - Choose GitHub and select your repository
   - Build settings (these should auto-detect):
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Click "Deploy site"

3. **Environment Variables:**
   - Go to Site Settings > Environment Variables
   - Add your Supabase credentials:
     - `VITE_SUPABASE_URL` = your Supabase URL
     - `VITE_SUPABASE_ANON_KEY` = your Supabase anon key

4. **Automatic Deployments:**
   - Every time you push to GitHub, Netlify will automatically rebuild and deploy!

## Option 2: Deploy to Vercel

1. **Install Vercel CLI:**
   ```bash
   npm install -g vercel
   ```

2. **Deploy:**
   ```bash
   vercel
   ```
   - Follow the prompts
   - Your site will be live instantly

3. **Add Environment Variables:**
   ```bash
   vercel env add VITE_SUPABASE_URL
   vercel env add VITE_SUPABASE_ANON_KEY
   ```

## Option 3: Deploy to Your Own Server

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Upload the `dist` folder:**
   - Use FTP, SFTP, or your hosting control panel
   - Upload all contents of `dist/` to your web server's public directory
   - Usually: `/public_html/`, `/www/`, or `/htdocs/`

3. **Configure Server:**
   - Ensure your server redirects all routes to `index.html` for single-page app routing
   - Example for Apache (`.htaccess`):
     ```apache
     <IfModule mod_rewrite.c>
       RewriteEngine On
       RewriteBase /
       RewriteRule ^index\.html$ - [L]
       RewriteCond %{REQUEST_FILENAME} !-f
       RewriteCond %{REQUEST_FILENAME} !-d
       RewriteRule . /index.html [L]
     </IfModule>
     ```

## After Deployment

### 1. Update Your Domain URLs

Replace all instances of `https://yourdomain.com` with your actual deployed URL in:
- `dist/index.html`
- `dist/sitemap.xml`

### 2. Configure Supabase

1. Go to your Supabase Dashboard
2. Navigate to Authentication > URL Configuration
3. Add your deployment URL to:
   - Site URL
   - Redirect URLs

### 3. Submit to Search Engines

1. **Google Search Console:**
   - Go to https://search.google.com/search-console
   - Add your property
   - Submit your sitemap: `https://yourdomain.com/sitemap.xml`

2. **Bing Webmaster Tools:**
   - Go to https://www.bing.com/webmasters
   - Add your site
   - Submit sitemap

### 4. Test Your Deployment

- ✅ Test login/signup
- ✅ Test real-time features (chat, GPS tracking)
- ✅ Test on mobile devices
- ✅ Test PWA installation (Add to Home Screen)
- ✅ Test offline functionality
- ✅ Check all pages load correctly

## Troubleshooting

### Issue: "Page not found" on refresh
- **Solution:** Configure server redirects (see Option 3 above)

### Issue: Environment variables not working
- **Solution:** Make sure all `VITE_*` variables are set in your hosting platform

### Issue: Supabase connection fails
- **Solution:** Add your deployment URL to Supabase Authentication settings

### Issue: Real-time features not working
- **Solution:** Check browser console for CORS errors. Verify Supabase URL configuration.

## Monitoring & Analytics

### Add Google Analytics (Optional)

1. Create a Google Analytics account
2. Get your Measurement ID
3. Add to `index.html` before `</head>`:
   ```html
   <script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
   <script>
     window.dataLayer = window.dataLayer || [];
     function gtag(){dataLayer.push(arguments);}
     gtag('js', new Date());
     gtag('config', 'GA_MEASUREMENT_ID');
   </script>
   ```

## Performance Optimization

Your site is already optimized with:
- ✅ Code splitting
- ✅ Asset compression (gzip)
- ✅ PWA caching
- ✅ Lazy loading
- ✅ CDN delivery (when using Netlify/Vercel)

## Security Checklist

- ✅ HTTPS enabled (automatic with Netlify/Vercel)
- ✅ Environment variables secured
- ✅ Row Level Security enabled in Supabase
- ✅ CORS configured properly
- ✅ Security headers configured (netlify.toml)

## Support

For deployment issues:
- Netlify: https://docs.netlify.com
- Vercel: https://vercel.com/docs
- Supabase: https://supabase.com/docs

---

**Your site is now ready to go live! 🚀**
