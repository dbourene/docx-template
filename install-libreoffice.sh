#!/bin/bash

echo "🚀 Installation de LibreOffice sur Render..."

# Mettre à jour les packages
apt-get update

# Installer LibreOffice et les dépendances
apt-get install -y \
  libreoffice \
  libreoffice-writer \
  fonts-dejavu \
  fonts-liberation \
  fontconfig

# Vérifier l'installation
libreoffice --version

echo "✅ LibreOffice installé avec succès"

# Log explicite
echo "✅ LibreOffice installé"
libreoffice --version || echo "❌ LibreOffice non disponible"