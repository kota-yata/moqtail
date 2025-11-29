.PHONY: install prod dev core-build

install:
	yarn install

prod:
	$(MAKE) core-build
	yarn --cwd client build

dev:
	$(MAKE) core-build
	yarn --cwd client dev

core-web-test:
	$(MAKE) core-build
	yarn --cwd moqtail-core web:dev

core-build:
	yarn --cwd bytes build
	yarn --cwd moqtail-core build
