# Utilise une image de base avec Node + LibreOffice
FROM ubuntu:22.04

# Installe Node.js
RUN apt-get update && apt-get install -y curl gnupg2 software-properties-common
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

# Installe LibreOffice en mode headless
RUN apt-get install -y libreoffice libreoffice-writer

# Crée le dossier de ton app
WORKDIR /usr/src/app

# Copie ton projet
COPY . .

# Installe les dépendances
RUN npm install

# Lancer ton app
CMD ["npm", "start"]
