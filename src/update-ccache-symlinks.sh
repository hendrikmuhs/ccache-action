#!/usr/bin/env bash

set -xv

export $(dpkg-architecture)
export -p | grep -i deb

#sed s/%DEB_HOST_MULTIARCH%/$(DEB_HOST_MULTIARCH)/ debian/update-ccache-symlinks.in >debian/ccache/usr/sbin/update-ccache-symlinks
sed s/%DEB_HOST_MULTIARCH%/$(DEB_HOST_MULTIARCH)/ update-ccache-symlinks.in ccache/usr/sbin/update-ccache-symlinks

# mkdir -p /usr/lib/ccache
./update-ccache-symlinks
# for t in gcc g++ cc c++ clang clang++; do ln -vs /usr/bin/ccache /usr/local/bin/$t; done
