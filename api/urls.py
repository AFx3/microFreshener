# demo_project/urls.py
from django.contrib import admin
from django.urls import include, path
from rest_framework.urlpatterns import format_suffix_patterns

from api import views

urlpatterns = [
    path('graph/', views.graph),
    path('graph/export/', views.graph_export),
    path('graph/import/', views.graph_import),
    path('graph/analyse/', views.graph_analysis),
    path('nodes/', views.nodes),
    path('nodes/<int:pk>/', views.node_detail),
]

urlpatterns = format_suffix_patterns(urlpatterns)
# We don't necessarily need to add these extra url patterns in, 
# but it gives us a simple, clean way of referring to a specific format.
# http http://127.0.0.1:8000/snippets.json  # JSON suffix
# http http://127.0.0.1:8000/snippets.api   # Browsable API suffix

# http http://127.0.0.1:8000/snippets/ Accept:application/json  # Request JSON
# http http://127.0.0.1:8000/snippets/ Accept:text/html         # Request HTML