cd ~/sites/onePageChords
rm -rf package/*
cp *.* packaged
cp v1/*.* packaged/v1
mkdir packaged/v1/images
mkdir packaged/v1/fpdf
cp v1/images/* packaged/v1/images
cp -rf v1/fpdf/* packaged/v1/fpdf
node node_modules/requirejs/bin/r.js -o name=v1/js/opc-required.js out=packaged/v1/js/opc-required.js baseUrl=.
cp v1/js/require.js packaged/v1/js/require.js
rm packaged/package.sh
cd packaged
jar -cf onePageChords.zip *
