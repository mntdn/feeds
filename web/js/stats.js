var app = angular.module('statsApp', []);

app.controller('statsController', function($scope, $rootScope, $window, $document, $http) {
	$scope.initFeeds = function(){
		$http.get("/allFeedsList")
			.then(function(response) {
				$scope.feeds = response.data;
			}, $scope.errorCallback);
		$http.get("/feedStatsErrors")
			.then(function(response) {
				$scope.statsErrors = response.data;
			}, $scope.errorCallback);
		$http.get("/feedStatsInsert")
			.then(function(response) {
				$scope.statsInsert = response.data;
			}, $scope.errorCallback);
	}

	$scope.initFeeds();

	$scope.editFeed = function(feed){
		$http.post("/editFeed?IdFeed="+feed.IdFeed+"&Name="+feed.Name+"&Url="+feed.Url)
			.then(function(response) {
			})
	}

	$scope.deleteFeed = function(feed){
		$http.post("/deleteFeed?IdFeed="+feed.IdFeed)
			.then(function(response) {
				var i;
				for(i = 0; i < $scope.feeds.length; i++)
					if($scope.feeds[i].IdFeed === feed.IdFeed)
						break;
				console.log(i, $scope.feeds[i]);
				$scope.feeds.splice(i,1);
				$scope.$apply();
			});
	}
});

app.directive('ngConfirmClick', [
    function(){
        return {
            link: function (scope, element, attr) {
                var msg = attr.ngConfirmClick || "Are you sure?";
                var clickAction = attr.confirmedClick;
                element.bind('click',function (event) {
                    if ( window.confirm(msg) ) {
                        scope.$eval(clickAction)
                    }
                });
            }
        };
	}
])
