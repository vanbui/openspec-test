#!/bin/bash

# This script overlays the new code from the source repo onto the existing code in the target repo.
#
# Make sure that you have created a new branch in the target repo before running this script. 
# The new branch should be based on the latest commit of the main branch of the target repo.
#
# Review the commands below, especially the Git checkout URLs for the source and destination repos, 
# then run this script to overlay the new code on top of the existing code in this repo 


cd ..

git clone https://github.com/vanbui/idambox.git overlay-target-repo
cd overlay-target-repo
# copy-6-overlay is the example branch name for the overlay. You can change it to whatever you want.
git checkout csrm-20260925

cd ..
git clone https://github.com/bproton-dev/csrm.git overlay-source-repo
cd overlay-source-repo
rm -rf .git

cd ../overlay-target-repo/ && rm -rf apps/backend apps/csrm 
rsync -av --remove-source-files ../overlay-source-repo/ ./
mv apps/strapi apps/backend
mv apps/web apps/csrm

git diff apps/csrm/.env.local.example
git diff apps/strapi/.env.example

echo "Overlay complete. Please review the changes above and commit them if everything looks good."
echo "Check the .env diffs above to see if there is any newly introduced environment variables."