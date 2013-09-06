test: clear
	@export DEBUG= && mocha

clear:
	@clear

authors:
	@git log --format='%aN <%aE>' | sort -u > AUTHORS

cov:
	@export DEBUG= && istanbul cover ./node_modules/.bin/_mocha && open ./coverage/lcov-report/index.html
