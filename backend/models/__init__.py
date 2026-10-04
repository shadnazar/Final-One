"""Models package for Celesta Glow backend"""
from .blog import Blog, BlogCreate, generate_slug, blog_to_dict, dict_to_blog
from .location import Location, LocationCreate, generate_location_slug, location_to_dict, dict_to_location
