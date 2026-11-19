GRAMPUSTAKA - VILLAGE LIBRARY FRONTEND
======================================

1. Copy the src folder, index.html, vite.config.js and package.json into
   your existing frontend folder (replace the generated starter files).
   Alternatively, extract this zip into a new folder and run npm install.

2. Make the backend category change in BACKEND_CATEGORY_CHANGE.txt and run
   the Django migrations.

3. In the frontend folder:
       npm install
       npm run dev

4. In a separate terminal, run Django:
       cd library_api
       ..\venv\Scripts\Activate.ps1
       python manage.py runserver

5. Open the Vite URL, usually http://localhost:5173

The frontend calls your existing Django REST API through the Vite proxy.
If your API endpoints or serializer fields differ from the project structure
discussed, tell me the exact response/error and we can adjust the integration.
