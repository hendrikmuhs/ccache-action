#!/usr/bin/env bash

set -xv

export $(dpkg-architecture)
export -p | grep -i deb

PN=$(dirname $0)

#sed s/%DEB_HOST_MULTIARCH%/$(DEB_HOST_MULTIARCH)/ debian/update-ccache-symlinks.in >debian/ccache/usr/sbin/update-ccache-symlinks
sed -e "s/%DEB_HOST_MULTIARCH%/$(DEB_HOST_MULTIARCH)/" $PN/update-ccache-symlinks.in > $PN/update-ccache-symlinks.pl
#sed -i -e 's/my $verbose = 0;/my $verbose = 1;/' $PN/update-ccache-symlinks.pl
sed -i -e 's|my $verbose = 0;|my $verbose = 1;      # mod # \0|' $PN/update-ccache-symlinks.pl
sed -i -e 's|my $ccache_dir = "/usr/lib/ccache";|my $ccache_dir = "/usr/local/lib/ccache";      # mod # \0|' $PN/update-ccache-symlinks.pl
#sed -i -e 's|    if (! -e "/usr/bin/$_") {|        print "Found existing symlinks $old_symlinks/$_\\n" if $verbose;      # mod #\n\0|' $PN/update-ccache-symlinks.pl
sed -i -e 's|    if (! -e "/usr/bin/$_") {|        print "Found existing symlinks $_\\n" if $verbose;      # mod #\n\0|' $PN/update-ccache-symlinks.pl

chmod 755 $PN/update-ccache-symlinks.pl

[ -d /usr/local/bin/ ] || mkdir -p /usr/local/bin/
[ -d /usr/local/lib/ccache/ ] || mkdir -p /usr/local/lib/ccache/
[ -e /usr/local/bin/ccache ] || touch /usr/local/bin/ccache
$PN/update-ccache-symlinks.pl
# Q&D replacement for update-ccache-symlinks.pl # for t in gcc g++ cc c++ clang clang++; do ln -vs /usr/local/bin/ccache /usr/local/lib/ccache/$t; done
# merker # cd /usr/lib/ccache/ && ln -s /usr/lib/ccache/* /usr/local/bin/
# cd /usr/local/bin && ln -s /usr/lib/ccache/bin/* .
#cd /usr/local/bin && ln -s /usr/local/lib/ccache/* .



# Prepend ccache into the PATH
echo '[ -d /usr/local/lib/ccache/ ] && export PATH="/usr/local/lib/ccache:$PATH"' | tee -a ~/.bashrc
echo '[ -d /usr/lib64/ccache/ ] && export PATH="/usr/lib64/ccache:$PATH"' | tee -a ~/.bashrc
echo '[ -d /usr/lib/ccache/ ] && export PATH="/usr/lib/ccache:$PATH"' | tee -a ~/.bashrc
#echo 'export CONFIG_CCACHE=y' | tee -a ~/.bashrc
# Source bashrc to test the new PATH
source ~/.bashrc && echo $PATH

cd /usr/local/bin && ln -s /usr/local/lib/ccache/* .
#for t in gcc g++ cc c++ clang clang++; do ln -vs /usr/bin/ccache /usr/local/bin/$t; done
for t in gcc g++ cc c++ clang clang++; do ln -vs /usr/local/bin/ccache /usr/local/bin/$t; done

# aufreumen
# cd /usr/local/bin/ && rm g++ cc c++ clang clang++ *g++ *cc *c++ *clang *clang++

# https://www.methodpark.de/blog/the-c-c-developers-guide-to-avoiding-office-swordfights-part-1-ccache/
# on On Debian/Ubuntu:
# export PATH="/usr/lib/ccache:$PATH"
# On Fedora/CentOS/RHEL:
# $ export PATH="/usr/lib64/ccache:$PATH"
# with my /usr/local copyed ccache binary
# $ export PATH="/usr/local/lib/ccache:$PATH"
