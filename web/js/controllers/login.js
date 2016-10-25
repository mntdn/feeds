angular.module('feedsApp').controller('loginController', function($scope, $rootScope, $http, $sce) {
	$scope.classShow = 'hide';
	$scope.loginMode = true;
	$scope.accountCreateMode = false;

	$scope.$on('open-login', function(event, args) {
		$scope.classShow = "";
	});

	$scope.createAccount = function(){
		$scope.loginMode = false;
		$scope.accountCreateMode = true;
	}

	$scope.doLogin = function(){
		$scope.classShow = 'hide';
		$http.post("/checkLogin?name="+$scope.login+"&pass="+$scope.password)
			.then(function(response) {
				$rootScope.$broadcast('login');
			});
		// $rootScope.$broadcast('login', {user: $scope.login});
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
});
