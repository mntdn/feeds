var app = angular.module('feedsApp', ['ang-drag-drop']);

app.factory('categories', function($http){
	var categories = {};
	categories.add = function(categoryName) {
		return $http.post("/addCategory?Name="+categoryName);
	}
	categories.delete = function(IdCategory) {
		return $http.post("/deleteCategory?IdCategory="+IdCategory);
	}
	return categories;
});

app.filter('orderObjectBy', function() {
	return function(items, field, reverse) {
		var filtered = [];
		angular.forEach(items, function(item) {
			filtered.push(item);
		});
		filtered.sort(function (a, b) {
			var s1 = a[field].toLowerCase();
	        var s2 = b[field].toLowerCase();
	        return (s1 < s2 ? -1 : s1 > s2 ? 1 : 0);
		});
		if(reverse) filtered.reverse();
		return filtered;
	};
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
