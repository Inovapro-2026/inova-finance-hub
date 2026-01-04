#!/bin/bash
# Script to synchronize Inova Finance Hub with GitHub

echo "Starting synchronization with GitHub..."

# Navigate to project root
cd /root/INOVAFINANCE

# Check if it's a git repo
if [ ! -d .git ]; then
    echo "Error: Not a git repository."
    exit 1
fi

# Add all changes
git add .

# Check if there are changes to commit
if git diff-index --quiet HEAD --; then
    echo "No changes to commit."
    exit 0
fi

# Commit with a timestamped message
COMMIT_MSG="Branding and PWA update at $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MSG"

# Pull latest changes from GitHub (rebase) to avoid conflicts
git pull --rebase origin main

# Push to GitHub
git push origin main

echo "Synchronization complete!"
