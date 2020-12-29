#!/bin/bash

git prune
git gc
rm shrinkwrap.yaml
enable-pnpm