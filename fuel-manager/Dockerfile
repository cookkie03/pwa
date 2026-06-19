FROM python:3.13-slim

WORKDIR /app

# Copy app files
COPY server.py .
COPY index.html .
COPY style.css .
COPY app.js .
COPY manifest.json .
COPY sw.js .
COPY icon.svg .
COPY icon-192.png .
COPY icon-512.png .
COPY apple-touch-icon.png .
COPY favicon-32.png .

# Data directory (volume mount point)
VOLUME /app/data

EXPOSE 8599

CMD ["python3", "server.py"]
