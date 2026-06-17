FROM python:3.13-slim

WORKDIR /app

# Copy app files
COPY server.py .
COPY index.html .
COPY style.css .
COPY app.js .
COPY manifest.json .
COPY sw.js .
COPY icon-192.png .
COPY icon-512.png .
COPY ca.pem .
COPY ca.key .
COPY ca.srl .
COPY server.csr .
COPY debian.tail234659.ts.net.crt .
COPY debian.tail234659.ts.net.key .
COPY apple-cert-mobileconfig .
COPY fuel-manager-ca.mobileconfig .

# Data directory (volume mount point)
VOLUME /app/data

EXPOSE 8599

CMD ["python3", "server.py"]
