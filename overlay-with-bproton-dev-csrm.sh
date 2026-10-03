#!/bin/bash

# This script overlays the new code from the source repo onto the existing code in the target repo.
#
# Make sure that you have created a new branch in the target repo before running this script. 
# The new branch should be based on the latest commit of the main branch of the target repo.
#
# Review the commands below, especially the Git checkout URLs for the source and destination repos, 
# then run this script to overlay the new code on top of the existing code in this repo 


cd ..

git clone https://github.com/bproton-dev/csrm.git overlay-source-repo
cd overlay-source-repo
# copy-6-overlay is the example branch name for the overlay. You can change it to whatever you want.
git checkout v2.0
rm -rf .git

cd ..
git clone https://github.com/vanbui/idambox.git overlay-target-repo
cd overlay-target-repo
git checkout csrm-20260928

cd ../overlay-target-repo/ && rm -rf apps
rsync -av --remove-source-files ../overlay-source-repo/ ./

git diff apps/backend/.env.example
git diff apps/csrm/.env.local.example

echo "Overlay complete. Please review the changes above and commit them if everything looks good."
echo "Check the .env diffs above to see if there is any newly introduced environment variables."