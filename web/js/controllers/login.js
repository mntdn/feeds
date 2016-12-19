angular.module('feedsApp').controller('loginController', function($scope, $rootScope, $http, $sce) {
	$scope.classShow = 'hide';
	$scope.loginMode = true;
	$scope.accountCreateMode = false;
	$scope.forgotPasswordMode = false;
	$scope.enterCodeMode = false;
	$scope.loginError = false;

	$scope.$on('open-login', function(event, args) {
		$scope.classShow = "";
	});

	$scope.createAccount = function(){
		$scope.loginMode = false;
		$scope.accountCreateMode = true;
		$scope.forgotPasswordMode = false;
		$scope.enterCodeMode = false;
	}

	$scope.forgotPassword = function(){
		$scope.loginMode = false;
		$scope.accountCreateMode = false;
		$scope.forgotPasswordMode = true;
		$scope.enterCodeMode = false;
	}

	$scope.enterCode = function(){
		$scope.loginMode = false;
		$scope.accountCreateMode = false;
		$scope.forgotPasswordMode = false;
		$scope.enterCodeMode = true;
	}

	$scope.doLogin = function(){
		$http.post("/checkLogin?name="+$scope.login+"&pass="+$scope.password)
			.then(function(response) {
				if(response.data.status === 'OK'){
					$scope.classShow = 'hide';
					$rootScope.$broadcast('login');
				} else {
					$scope.loginError = true;
					$scope.errorMessage = response.data.errorMessage || 'Error';
				}
			});
	}

	$scope.doCreate = function(){
		if($scope.createPassword === $scope.createPasswordCheck){
			$http.post("/createAccount?name="+$scope.createLogin+"&pass="+$scope.createPassword)
				.then(function(response) {
					$scope.loginMode = true;
					$scope.accountCreateMode = false;
				});
		}
	}

	$scope.sendPasswordMail = function(){
		$http.post("/sendPasswordMail?mail="+$scope.eMailPassword)
			.then(function(response) {
				console.log(response);
			});
	}

	$scope.changePassword = function() {
		if($scope.resetPassword === $scope.resetPasswordConfirm){
			$http.post("/resetPassword?login="+$scope.resetLogin+"&pass="+$scope.resetPassword+"&c="+$scope.resetCode)
				.then(function(response) {
					console.log(response);
				});
		}
	}
});
