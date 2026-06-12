# Makefile for Trener

.PHONY: clean clean-android build-web release sync rebuild-apk sign install deploy

clean:
	rm -rf dist release-web trener.zip Trener.apk Trener.sign.apk

clean-android:
	rm -rf android

build-web:
	node scripts/bump_version.js
	npm run build

release: build-web
	rm -rf release-web trener.zip
	mkdir -p release-web
	cp -R dist/. release-web/
	printf '%s\n' \
		'Trener - webova verzia' \
		'' \
		'Spustenie v prehliadaci:' \
		'1. Rozbal trener.zip.' \
		'2. V adresari, kam si aplikaciu rozbalil, spusti lokalny web server:' \
		'   python3 -m http.server 8080' \
		'3. Otvor v prehliadaci:' \
		'   http://localhost:8080/' \
		'' \
		'Poznamka: Neotvaraj index.html priamo cez file://. Aplikacia potrebuje bezat cez web server.' \
		> release-web/SPUSTENIE.txt
	cd release-web && zip -qr ../trener.zip .
	rm -rf release-web
	@echo "Release complete: ./trener.zip"

sync: build-web
	npx cap add android || true
	npx cap sync

rebuild-apk: sync
	podman run --rm -v "$$(pwd):/project" -w "/project/android" docker.io/mingc/android-build-box bash -c "./gradlew assembleDebug"
	cp android/app/build/outputs/apk/debug/app-debug.apk ./Trener.apk
	@echo "Build complete! APK is at ./Trener.apk"

sign:
	../android.sign.sh Trener.apk Trener.sign.apk

install:
	adb install -r Trener.sign.apk

deploy: rebuild-apk sign install
