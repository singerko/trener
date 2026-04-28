# Makefile for Trener

clean:
	rm -rf dist Trener.apk Trener.sign.apk

clean-android:
	rm -rf android

build-web:
	node scripts/bump_version.js
	npm run build

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
