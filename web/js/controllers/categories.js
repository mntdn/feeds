angular.module('feedsApp').controller('categoriesController', function($scope, $rootScope, $http, $sce, categories) {
	$scope.nbGens = 12;
	$scope.classShow = 'hide';
	$scope.currentUser = '';
	$scope.showMessageBox = false;

	$scope.$on('open-categories-dialog', function(event, args) {
		$scope.classShow = "";
		$scope.currentUser = args.userName;
		$http.get("/allFeedsList")
		.then(function(rez) {
			$scope.feeds = rez.data;
		});

		$http.get("/allCategoriesList")
		.then(function(rez) {
			rez.data.unshift({"IdCategory":-1, "Name":"None"});
			for(var i = 0; i < rez.data.length; i++){
				rez.data[i]["nbItemsShown"] = 10;
				rez.data[i]["searchTerm"] = '';
			}
			$scope.categories = rez.data;
		});
	});

	$scope.closeDialog = function() {
		$scope.classShow = 'hide';
		$rootScope.$broadcast('close-dialog');
	}

	$scope.onDrop = function($event,$data, idCategory){
		var idFeed = parseInt($data, 10);
		$http.post("/changeFeedCategory?IdFeed="+idFeed+"&IdCategory="+idCategory)
			.then(function(response) {
				for(var i = 0; i<$scope.feeds.length; i++){
					if($scope.feeds[i].IdFeed == idFeed){
						$scope.feeds[i].IdCategory = idCategory;
						break;
					}
				}
			});
	};

	$scope.addCategory = function(){
		categories.add($scope.categoryToAddName).then(function(response) {
			$scope.categories.push(response.data[0]);
		});
	}

	$scope.deleteCategory = function(IdCategory){
		categories.delete(IdCategory)
			.then(function(response) {
				var i;
				for(i = 0; i < $scope.categories.length; i++)
					if($scope.categories[i].IdCategory === IdCategory)
						break;
				console.log(i, $scope.categories[i]);
				$scope.categories.splice(i,1);
			});
	}

	$scope.addOrRemove = function(currentFeed){
		if(currentFeed.IsSubscribed === 0){
			return "plus";
		} else {
			return "minus";
		}
	}

	$scope.showFeed = function(feed){
		for(var i = 0; i < $scope.feeds.length; i++){
			if($scope.feeds[i].IdFeed === feed.IdFeed) {
				$scope.feeds[i].IsShown = !$scope.feeds[i].IsShown;
				break;
			}
		}
	}

	$scope.feedChangeCategory = function(feed){
		$http.post("/changeFeedCategory?IdFeed="+feed.IdFeed+"&IdCategory="+feed.IdCategory)
			.then(function(response) {});
	}
});
