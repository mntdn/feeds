var app = angular.module('feedsApp', []);
app.controller('feedsController', function($scope, $http, $sce) {
	$http.get("/feedsList")
		.then(function(response) {
			$scope.feeds = response.data;
		});
	
	$scope.feedLoad = function(idFeed){
		$http.get("/feedContent?id="+idFeed)
			.then(function(response) {
				for (var i = 0; i < response.data.length; i++) {
					response.data[i].Content = $sce.trustAsHtml(response.data[i].Content);
				}
				$scope.feedContent = response.data;
			});
	}
});