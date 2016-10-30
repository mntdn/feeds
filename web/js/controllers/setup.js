angular.module('feedsApp').controller('setupController', function($scope, $rootScope, $http, $sce, categories) {
	$scope.classShow = 'hide';
	$scope.currentUser = '';
	$scope.randomGif = 1;

	$scope.$on('open-dialog', function(event, args) {
		$scope.classShow = "";
		$scope.randomGif = $scope.getRandomInt(1,5);
		$scope.currentUser = args.userName;
	});

	$scope.getRandomInt = function(min, max) {
		//[min, max[
	    return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	$scope.closeDialog = function() {
		$scope.classShow = 'hide';
		$rootScope.$broadcast('close-dialog');
	}

});
