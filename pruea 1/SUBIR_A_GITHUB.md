# Cómo cargar estos archivos a GitHub

Repositorio de destino:

<https://github.com/ACOPIO-AMS/ATENCION-AL-CLIENTE>

## Con GitHub Desktop

1. Extrae el archivo ZIP.
2. Abre GitHub Desktop y elige **File → Add local repository**.
3. Selecciona la carpeta `ATENCION-AL-CLIENTE`.
4. Si solicita crear el repositorio local, acepta.
5. Confirma que no aparezcan archivos `.env.local`, claves ni bases de datos.
6. Publica o empuja el contenido a `ACOPIO-AMS/ATENCION-AL-CLIENTE`.

## Con Git

Ejecuta estos comandos dentro de la carpeta extraída:

```bash
git init
git branch -M main
git remote add origin https://github.com/ACOPIO-AMS/ATENCION-AL-CLIENTE.git
git add -- .env.example .github .gitignore .npmrc .openai README.md SUBIR_A_GITHUB.md app build db drizzle.config.ts drizzle examples eslint.config.mjs google-apps-script next.config.ts package-lock.json package.json postcss.config.mjs public scripts tests tsconfig.json vite.config.ts worker
git commit -m "Carga inicial de Atención al Cliente V8"
git push -u origin main
```

Si GitHub solicita iniciar sesión o indica que no tienes permiso de escritura, entra con la cuenta propietaria de la organización `ACOPIO-AMS` o concede permiso de escritura a tu cuenta.

## No subir

- `.env.local`
- Claves de Apps Script
- Copias de Google Sheets o Excel con datos personales
- Carpetas `node_modules`, `dist`, `.next` o archivos temporales

El backend correcto está en `google-apps-script/Code.gs` y declara la versión `ATENCION-2026-08-19-V8`.
