# API Documentation (OpenAPI)

Summarized from Supabase PostgREST.

**External URL:** https://pavnfiladmnwbptwlwpr.supabase.co/rest/v1/

### /
- **GET**: OpenAPI description (this document)

### /activities
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /activity_participants
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /activity_skills
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /admin_audit_logs
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /app_spatial_ref_sys
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /applications
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /blocked_users
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /community_posts
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /community_reports
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /conversation_participants
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /conversations
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /faq_feedback
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /gamification_state
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /geography_columns
- **GET**: No summary

### /geometry_columns
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /internal_secrets
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /levels
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /messages
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /notification_logs
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /notifications
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /npo_followers
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /post_reactions
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /profiles
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /reports
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /reviews
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /rpc/_postgis_deprecate
- **GET**: No summary
- **POST**: No summary

### /rpc/_postgis_index_extent
- **GET**: No summary
- **POST**: No summary

### /rpc/_postgis_pgsql_version
- **GET**: No summary
- **POST**: No summary

### /rpc/_postgis_scripts_pgsql_version
- **GET**: No summary
- **POST**: No summary

### /rpc/_postgis_selectivity
- **POST**: No summary

### /rpc/_postgis_stats
- **POST**: No summary

### /rpc/_st_3ddfullywithin
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_3ddwithin
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_3dintersects
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_contains
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_containsproperly
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_coveredby
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_covers
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_crosses
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_dfullywithin
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_dwithin
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_equals
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_intersects
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_linecrossingdirection
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_longestline
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_maxdistance
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_orderingequals
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_overlaps
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_sortablehash
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_touches
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_voronoi
- **GET**: No summary
- **POST**: No summary

### /rpc/_st_within
- **GET**: No summary
- **POST**: No summary

### /rpc/addauth
- **POST**: args: auth_token - Adds an authorization token to be used in the current transaction.

### /rpc/addgeometrycolumn
- **POST**: args: catalog_name, schema_name, table_name, column_name, srid, type, dimension, use_typmod=true - Adds a geometry column to an existing table.

### /rpc/award_activity_completion_to_user
- **POST**: No summary

### /rpc/award_gamification_xp
- **POST**: No summary

### /rpc/calculate_level_from_xp
- **GET**: No summary
- **POST**: No summary

### /rpc/disablelongtransactions
- **POST**: Disables long transaction support.

### /rpc/dropgeometrycolumn
- **POST**: args: catalog_name, schema_name, table_name, column_name - Removes a geometry column from a spatial table.

### /rpc/dropgeometrytable
- **POST**: args: catalog_name, schema_name, table_name - Drops a table and all its references in geometry_columns.

### /rpc/earth
- **GET**: No summary
- **POST**: No summary

### /rpc/enablelongtransactions
- **POST**: Enables long transaction support.

### /rpc/equals
- **GET**: No summary
- **POST**: No summary

### /rpc/geography
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_above
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_below
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_cmp
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_contained_3d
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_contains
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_contains_3d
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_distance_box
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_distance_centroid
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_eq
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_ge
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_gist_same_2d
- **POST**: No summary

### /rpc/geometry_gt
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_le
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_left
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_lt
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_overabove
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_overbelow
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_overlaps
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_overlaps_3d
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_overleft
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_overright
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_right
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_same
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_same_3d
- **GET**: No summary
- **POST**: No summary

### /rpc/geometry_within
- **GET**: No summary
- **POST**: No summary

### /rpc/geomfromewkb
- **GET**: No summary
- **POST**: No summary

### /rpc/geomfromewkt
- **GET**: No summary
- **POST**: No summary

### /rpc/get_activities_near_me
- **POST**: No summary

### /rpc/get_activities_with_match
- **POST**: No summary

### /rpc/get_matching_volunteers
- **POST**: No summary

### /rpc/get_my_conversations
- **POST**: No summary

### /rpc/get_report_count
- **POST**: No summary

### /rpc/get_rls_summary
- **POST**: No summary

### /rpc/get_unread_messages_count
- **POST**: No summary

### /rpc/gettransactionid
- **POST**: No summary

### /rpc/longtransactionsenabled
- **POST**: No summary

### /rpc/match_activities
- **POST**: No summary

### /rpc/populate_geometry_columns
- **POST**: args: relation_oid, use_typmod=true - Ensures geometry columns are defined with type modifiers or have appropriate spatial constraints.

### /rpc/postgis_constraint_dims
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_constraint_srid
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_constraint_type
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_extensions_upgrade
- **POST**: Packages and upgrades PostGIS extensions (e.g. postgis_raster,postgis_topology, postgis_sfcgal) to latest available version.

### /rpc/postgis_full_version
- **GET**: Reports full PostGIS version and build configuration infos.
- **POST**: Reports full PostGIS version and build configuration infos.

### /rpc/postgis_geos_version
- **GET**: Returns the version number of the GEOS library.
- **POST**: Returns the version number of the GEOS library.

### /rpc/postgis_lib_build_date
- **GET**: Returns build date of the PostGIS library.
- **POST**: Returns build date of the PostGIS library.

### /rpc/postgis_lib_revision
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_lib_version
- **GET**: Returns the version number of the PostGIS library.
- **POST**: Returns the version number of the PostGIS library.

### /rpc/postgis_libjson_version
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_liblwgeom_version
- **GET**: Returns the version number of the liblwgeom library. This should match the version of PostGIS.
- **POST**: Returns the version number of the liblwgeom library. This should match the version of PostGIS.

### /rpc/postgis_libprotobuf_version
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_libxml_version
- **GET**: Returns the version number of the libxml2 library.
- **POST**: Returns the version number of the libxml2 library.

### /rpc/postgis_proj_version
- **GET**: Returns the version number of the PROJ4 library.
- **POST**: Returns the version number of the PROJ4 library.

### /rpc/postgis_scripts_build_date
- **GET**: Returns build date of the PostGIS scripts.
- **POST**: Returns build date of the PostGIS scripts.

### /rpc/postgis_scripts_installed
- **GET**: Returns version of the PostGIS scripts installed in this database.
- **POST**: Returns version of the PostGIS scripts installed in this database.

### /rpc/postgis_scripts_released
- **GET**: Returns the version number of the postgis.sql script released with the installed PostGIS lib.
- **POST**: Returns the version number of the postgis.sql script released with the installed PostGIS lib.

### /rpc/postgis_svn_version
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_transform_geometry
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_type_name
- **GET**: No summary
- **POST**: No summary

### /rpc/postgis_version
- **GET**: Returns PostGIS version number and compile-time options.
- **POST**: Returns PostGIS version number and compile-time options.

### /rpc/postgis_wagyu_version
- **GET**: Returns the version number of the internal Wagyu library.
- **POST**: Returns the version number of the internal Wagyu library.

### /rpc/record_activity_share
- **POST**: No summary

### /rpc/st_3dclosestpoint
- **GET**: args: g1, g2 - Returns the 3D point on g1 that is closest to g2. This is the first point of the 3D shortest line.
- **POST**: args: g1, g2 - Returns the 3D point on g1 that is closest to g2. This is the first point of the 3D shortest line.

### /rpc/st_3ddfullywithin
- **GET**: No summary
- **POST**: No summary

### /rpc/st_3ddistance
- **GET**: args: g1, g2 - Returns the 3D cartesian minimum distance (based on spatial ref) between two geometries in projected units.
- **POST**: args: g1, g2 - Returns the 3D cartesian minimum distance (based on spatial ref) between two geometries in projected units.

### /rpc/st_3ddwithin
- **GET**: No summary
- **POST**: No summary

### /rpc/st_3dintersects
- **GET**: No summary
- **POST**: No summary

### /rpc/st_3dlongestline
- **GET**: args: g1, g2 - Returns the 3D longest line between two geometries
- **POST**: args: g1, g2 - Returns the 3D longest line between two geometries

### /rpc/st_3dmakebox
- **GET**: args: point3DLowLeftBottom, point3DUpRightTop - Creates a BOX3D defined by two 3D point geometries.
- **POST**: args: point3DLowLeftBottom, point3DUpRightTop - Creates a BOX3D defined by two 3D point geometries.

### /rpc/st_3dmaxdistance
- **GET**: args: g1, g2 - Returns the 3D cartesian maximum distance (based on spatial ref) between two geometries in projected units.
- **POST**: args: g1, g2 - Returns the 3D cartesian maximum distance (based on spatial ref) between two geometries in projected units.

### /rpc/st_3dshortestline
- **GET**: args: g1, g2 - Returns the 3D shortest line between two geometries
- **POST**: args: g1, g2 - Returns the 3D shortest line between two geometries

### /rpc/st_addpoint
- **GET**: args: linestring, point, position = -1 - Add a point to a LineString.
- **POST**: args: linestring, point, position = -1 - Add a point to a LineString.

### /rpc/st_angle
- **GET**: args: point1, point2, point3, point4 - Returns the angle between two vectors defined by 3 or 4 points, or 2 lines.
- **POST**: args: point1, point2, point3, point4 - Returns the angle between two vectors defined by 3 or 4 points, or 2 lines.

### /rpc/st_area
- **GET**: args: geog, use_spheroid=true - Returns the area of a polygonal geometry.
- **POST**: args: geog, use_spheroid=true - Returns the area of a polygonal geometry.

### /rpc/st_asencodedpolyline
- **GET**: No summary
- **POST**: No summary

### /rpc/st_asewkt
- **GET**: No summary
- **POST**: No summary

### /rpc/st_asgeojson
- **GET**: No summary
- **POST**: No summary

### /rpc/st_asgml
- **GET**: No summary
- **POST**: No summary

### /rpc/st_askml
- **GET**: No summary
- **POST**: No summary

### /rpc/st_aslatlontext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_asmarc21
- **GET**: No summary
- **POST**: No summary

### /rpc/st_asmvtgeom
- **GET**: No summary
- **POST**: No summary

### /rpc/st_assvg
- **GET**: No summary
- **POST**: No summary

### /rpc/st_astext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_astwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_asx3d
- **GET**: No summary
- **POST**: No summary

### /rpc/st_azimuth
- **GET**: args: origin, target - Returns the north-based azimuth of a line between two points.
- **POST**: args: origin, target - Returns the north-based azimuth of a line between two points.

### /rpc/st_boundingdiagonal
- **GET**: args: geom, fits=false - Returns the diagonal of a geometrys bounding box.
- **POST**: args: geom, fits=false - Returns the diagonal of a geometrys bounding box.

### /rpc/st_buffer
- **GET**: args: g1, radius_of_buffer, num_seg_quarter_circle - Computes a geometry covering all points within a given distance from a geometry.
- **POST**: args: g1, radius_of_buffer, num_seg_quarter_circle - Computes a geometry covering all points within a given distance from a geometry.

### /rpc/st_centroid
- **GET**: args: g1, use_spheroid=true - Returns the geometric center of a geometry.
- **POST**: args: g1, use_spheroid=true - Returns the geometric center of a geometry.

### /rpc/st_clipbybox2d
- **GET**: args: geom, box - Computes the portion of a geometry falling within a rectangle.
- **POST**: args: geom, box - Computes the portion of a geometry falling within a rectangle.

### /rpc/st_closestpoint
- **GET**: args: geom1, geom2 - Returns the 2D point on g1 that is closest to g2. This is the first point of the shortest line from one geometry to the other.
- **POST**: args: geom1, geom2 - Returns the 2D point on g1 that is closest to g2. This is the first point of the shortest line from one geometry to the other.

### /rpc/st_collect
- **GET**: args: g1, g2 - Creates a GeometryCollection or Multi* geometry from a set of geometries.
- **POST**: args: g1, g2 - Creates a GeometryCollection or Multi* geometry from a set of geometries.

### /rpc/st_concavehull
- **GET**: args: param_geom, param_pctconvex, param_allow_holes = false - Computes a possibly concave geometry that encloses all input geometry vertices
- **POST**: args: param_geom, param_pctconvex, param_allow_holes = false - Computes a possibly concave geometry that encloses all input geometry vertices

### /rpc/st_contains
- **GET**: No summary
- **POST**: No summary

### /rpc/st_containsproperly
- **GET**: No summary
- **POST**: No summary

### /rpc/st_coorddim
- **GET**: args: geomA - Return the coordinate dimension of a geometry.
- **POST**: args: geomA - Return the coordinate dimension of a geometry.

### /rpc/st_coveredby
- **GET**: No summary
- **POST**: No summary

### /rpc/st_covers
- **GET**: No summary
- **POST**: No summary

### /rpc/st_crosses
- **GET**: No summary
- **POST**: No summary

### /rpc/st_curvetoline
- **GET**: args: curveGeom, tolerance, tolerance_type, flags - Converts a geometry containing curves to a linear geometry.
- **POST**: args: curveGeom, tolerance, tolerance_type, flags - Converts a geometry containing curves to a linear geometry.

### /rpc/st_delaunaytriangles
- **GET**: args: g1, tolerance, flags - Returns the Delaunay triangulation of the vertices of a geometry.
- **POST**: args: g1, tolerance, flags - Returns the Delaunay triangulation of the vertices of a geometry.

### /rpc/st_dfullywithin
- **GET**: No summary
- **POST**: No summary

### /rpc/st_difference
- **GET**: args: geomA, geomB, gridSize = -1 - Computes a geometry representing the part of geometry A that does not intersect geometry B.
- **POST**: args: geomA, geomB, gridSize = -1 - Computes a geometry representing the part of geometry A that does not intersect geometry B.

### /rpc/st_disjoint
- **GET**: No summary
- **POST**: No summary

### /rpc/st_distance
- **GET**: args: geog1, geog2, use_spheroid=true - Returns the distance between two geometry or geography values.
- **POST**: args: geog1, geog2, use_spheroid=true - Returns the distance between two geometry or geography values.

### /rpc/st_distancesphere
- **GET**: args: geomlonlatA, geomlonlatB, radius=6371008 - Returns minimum distance in meters between two lon/lat geometries using a spherical earth model.
- **POST**: args: geomlonlatA, geomlonlatB, radius=6371008 - Returns minimum distance in meters between two lon/lat geometries using a spherical earth model.

### /rpc/st_distancespheroid
- **GET**: args: geomlonlatA, geomlonlatB, measurement_spheroid=WGS84 - Returns the minimum distance between two lon/lat geometries using a spheroidal earth model.
- **POST**: args: geomlonlatA, geomlonlatB, measurement_spheroid=WGS84 - Returns the minimum distance between two lon/lat geometries using a spheroidal earth model.

### /rpc/st_dwithin
- **GET**: No summary
- **POST**: No summary

### /rpc/st_equals
- **GET**: No summary
- **POST**: No summary

### /rpc/st_expand
- **GET**: args: geom, dx, dy, dz=0, dm=0 - Returns a bounding box expanded from another bounding box or a geometry.
- **POST**: args: geom, dx, dy, dz=0, dm=0 - Returns a bounding box expanded from another bounding box or a geometry.

### /rpc/st_force3d
- **GET**: args: geomA, Zvalue = 0.0 - Force the geometries into XYZ mode. This is an alias for ST_Force3DZ.
- **POST**: args: geomA, Zvalue = 0.0 - Force the geometries into XYZ mode. This is an alias for ST_Force3DZ.

### /rpc/st_force3dm
- **GET**: args: geomA, Mvalue = 0.0 - Force the geometries into XYM mode.
- **POST**: args: geomA, Mvalue = 0.0 - Force the geometries into XYM mode.

### /rpc/st_force3dz
- **GET**: args: geomA, Zvalue = 0.0 - Force the geometries into XYZ mode.
- **POST**: args: geomA, Zvalue = 0.0 - Force the geometries into XYZ mode.

### /rpc/st_force4d
- **GET**: args: geomA, Zvalue = 0.0, Mvalue = 0.0 - Force the geometries into XYZM mode.
- **POST**: args: geomA, Zvalue = 0.0, Mvalue = 0.0 - Force the geometries into XYZM mode.

### /rpc/st_forcesfs
- **GET**: args: geomA, version - Force the geometries to use SFS 1.1 geometry types only.
- **POST**: args: geomA, version - Force the geometries to use SFS 1.1 geometry types only.

### /rpc/st_frechetdistance
- **GET**: args: g1, g2, densifyFrac = -1 - Returns the Fréchet distance between two geometries.
- **POST**: args: g1, g2, densifyFrac = -1 - Returns the Fréchet distance between two geometries.

### /rpc/st_generatepoints
- **GET**: args: g, npoints, seed - Generates random points contained in a Polygon or MultiPolygon.
- **POST**: args: g, npoints, seed - Generates random points contained in a Polygon or MultiPolygon.

### /rpc/st_geogfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geogfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geographyfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geohash
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomcollfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomcollfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geometricmedian
- **GET**: args: geom, tolerance = NULL, max_iter = 10000, fail_if_not_converged = false - Returns the geometric median of a MultiPoint.
- **POST**: args: geom, tolerance = NULL, max_iter = 10000, fail_if_not_converged = false - Returns the geometric median of a MultiPoint.

### /rpc/st_geometryfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromewkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromewkt
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromgeojson
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromgml
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromkml
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfrommarc21
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromtwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_geomfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_gmltosql
- **GET**: No summary
- **POST**: No summary

### /rpc/st_hasarc
- **GET**: args: geomA - Tests if a geometry contains a circular arc
- **POST**: args: geomA - Tests if a geometry contains a circular arc

### /rpc/st_hausdorffdistance
- **GET**: args: g1, g2, densifyFrac - Returns the Hausdorff distance between two geometries.
- **POST**: args: g1, g2, densifyFrac - Returns the Hausdorff distance between two geometries.

### /rpc/st_hexagon
- **GET**: args: size, cell_i, cell_j, origin - Returns a single hexagon, using the provided edge size and cell coordinate within the hexagon grid space.
- **POST**: args: size, cell_i, cell_j, origin - Returns a single hexagon, using the provided edge size and cell coordinate within the hexagon grid space.

### /rpc/st_hexagongrid
- **GET**: args: size, bounds - Returns a set of hexagons and cell indices that completely cover the bounds of the geometry argument.
- **POST**: args: size, bounds - Returns a set of hexagons and cell indices that completely cover the bounds of the geometry argument.

### /rpc/st_interpolatepoint
- **GET**: args: linear_geom_with_measure, point - Returns the interpolated measure of a geometry closest to a point.
- **POST**: args: linear_geom_with_measure, point - Returns the interpolated measure of a geometry closest to a point.

### /rpc/st_intersection
- **GET**: args: geomA, geomB, gridSize = -1 - Computes a geometry representing the shared portion of geometries A and B.
- **POST**: args: geomA, geomB, gridSize = -1 - Computes a geometry representing the shared portion of geometries A and B.

### /rpc/st_intersects
- **GET**: No summary
- **POST**: No summary

### /rpc/st_isvaliddetail
- **GET**: args: geom, flags - Returns a valid_detail row stating if a geometry is valid or if not a reason and a location.
- **POST**: args: geom, flags - Returns a valid_detail row stating if a geometry is valid or if not a reason and a location.

### /rpc/st_length
- **GET**: args: geog, use_spheroid=true - Returns the 2D length of a linear geometry.
- **POST**: args: geog, use_spheroid=true - Returns the 2D length of a linear geometry.

### /rpc/st_letters
- **GET**: args:  letters,  font - Returns the input letters rendered as geometry with a default start position at the origin and default text height of 100.
- **POST**: args:  letters,  font - Returns the input letters rendered as geometry with a default start position at the origin and default text height of 100.

### /rpc/st_linecrossingdirection
- **GET**: No summary
- **POST**: No summary

### /rpc/st_linefromencodedpolyline
- **GET**: No summary
- **POST**: No summary

### /rpc/st_linefromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_linefromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_lineinterpolatepoints
- **GET**: args: a_linestring, a_fraction, repeat - Returns points interpolated along a line at a fractional interval.
- **POST**: args: a_linestring, a_fraction, repeat - Returns points interpolated along a line at a fractional interval.

### /rpc/st_linelocatepoint
- **GET**: args: a_linestring, a_point - Returns the fractional location of the closest point on a line to a point.
- **POST**: args: a_linestring, a_point - Returns the fractional location of the closest point on a line to a point.

### /rpc/st_linestringfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_linetocurve
- **GET**: args: geomANoncircular - Converts a linear geometry to a curved geometry.
- **POST**: args: geomANoncircular - Converts a linear geometry to a curved geometry.

### /rpc/st_locatealong
- **GET**: args: geom_with_measure, measure, offset = 0 - Returns the point(s) on a geometry that match a measure value.
- **POST**: args: geom_with_measure, measure, offset = 0 - Returns the point(s) on a geometry that match a measure value.

### /rpc/st_locatebetween
- **GET**: args: geom, measure_start, measure_end, offset = 0 - Returns the portions of a geometry that match a measure range.
- **POST**: args: geom, measure_start, measure_end, offset = 0 - Returns the portions of a geometry that match a measure range.

### /rpc/st_locatebetweenelevations
- **GET**: args: geom, elevation_start, elevation_end - Returns the portions of a geometry that lie in an elevation (Z) range.
- **POST**: args: geom, elevation_start, elevation_end - Returns the portions of a geometry that lie in an elevation (Z) range.

### /rpc/st_longestline
- **GET**: args: g1, g2 - Returns the 2D longest line between two geometries.
- **POST**: args: g1, g2 - Returns the 2D longest line between two geometries.

### /rpc/st_makebox2d
- **GET**: args: pointLowLeft, pointUpRight - Creates a BOX2D defined by two 2D point geometries.
- **POST**: args: pointLowLeft, pointUpRight - Creates a BOX2D defined by two 2D point geometries.

### /rpc/st_makeline
- **GET**: args: geom1, geom2 - Creates a LineString from Point, MultiPoint, or LineString geometries.
- **POST**: args: geom1, geom2 - Creates a LineString from Point, MultiPoint, or LineString geometries.

### /rpc/st_makevalid
- **GET**: args: input, params - Attempts to make an invalid geometry valid without losing vertices.
- **POST**: args: input, params - Attempts to make an invalid geometry valid without losing vertices.

### /rpc/st_maxdistance
- **GET**: args: g1, g2 - Returns the 2D largest distance between two geometries in projected units.
- **POST**: args: g1, g2 - Returns the 2D largest distance between two geometries in projected units.

### /rpc/st_maximuminscribedcircle
- **GET**: args: geom - Computes the largest circle contained within a geometry.
- **POST**: args: geom - Computes the largest circle contained within a geometry.

### /rpc/st_minimumboundingcircle
- **GET**: args: geomA, num_segs_per_qt_circ=48 - Returns the smallest circle polygon that contains a geometry.
- **POST**: args: geomA, num_segs_per_qt_circ=48 - Returns the smallest circle polygon that contains a geometry.

### /rpc/st_minimumboundingradius
- **GET**: args: geom - Returns the center point and radius of the smallest circle that contains a geometry.
- **POST**: args: geom - Returns the center point and radius of the smallest circle that contains a geometry.

### /rpc/st_mlinefromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_mlinefromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_mpointfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_mpointfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_mpolyfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_mpolyfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_multilinefromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_multilinestringfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_multipointfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_multipointfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_multipolyfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_multipolygonfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_node
- **GET**: args: geom - Nodes a collection of lines.
- **POST**: args: geom - Nodes a collection of lines.

### /rpc/st_normalize
- **GET**: args: geom - Return the geometry in its canonical form.
- **POST**: args: geom - Return the geometry in its canonical form.

### /rpc/st_offsetcurve
- **GET**: args: line, signed_distance, style_parameters=' - Returns an offset line at a given distance and side from an input line.
- **POST**: args: line, signed_distance, style_parameters=' - Returns an offset line at a given distance and side from an input line.

### /rpc/st_orderingequals
- **GET**: No summary
- **POST**: No summary

### /rpc/st_overlaps
- **GET**: No summary
- **POST**: No summary

### /rpc/st_perimeter
- **GET**: args: geog, use_spheroid=true - Returns the length of the boundary of a polygonal geometry or geography.
- **POST**: args: geog, use_spheroid=true - Returns the length of the boundary of a polygonal geometry or geography.

### /rpc/st_point
- **GET**: args: x, y, srid=unknown - Creates a Point with X, Y and SRID values.
- **POST**: args: x, y, srid=unknown - Creates a Point with X, Y and SRID values.

### /rpc/st_pointfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_pointfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_pointm
- **GET**: args: x, y, m, srid=unknown - Creates a Point with X, Y, M and SRID values.
- **POST**: args: x, y, m, srid=unknown - Creates a Point with X, Y, M and SRID values.

### /rpc/st_pointz
- **GET**: args: x, y, z, srid=unknown - Creates a Point with X, Y, Z and SRID values.
- **POST**: args: x, y, z, srid=unknown - Creates a Point with X, Y, Z and SRID values.

### /rpc/st_pointzm
- **GET**: args: x, y, z, m, srid=unknown - Creates a Point with X, Y, Z, M and SRID values.
- **POST**: args: x, y, z, m, srid=unknown - Creates a Point with X, Y, Z, M and SRID values.

### /rpc/st_polyfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_polyfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_polygonfromtext
- **GET**: No summary
- **POST**: No summary

### /rpc/st_polygonfromwkb
- **GET**: No summary
- **POST**: No summary

### /rpc/st_project
- **GET**: args: g1, distance, azimuth - Returns a point projected from a start point by a distance and bearing (azimuth).
- **POST**: args: g1, distance, azimuth - Returns a point projected from a start point by a distance and bearing (azimuth).

### /rpc/st_quantizecoordinates
- **GET**: args: g, prec_x, prec_y, prec_z, prec_m - Sets least significant bits of coordinates to zero
- **POST**: args: g, prec_x, prec_y, prec_z, prec_m - Sets least significant bits of coordinates to zero

### /rpc/st_reduceprecision
- **GET**: args: g, gridsize - Returns a valid geometry with points rounded to a grid tolerance.
- **POST**: args: g, gridsize - Returns a valid geometry with points rounded to a grid tolerance.

### /rpc/st_relate
- **GET**: No summary
- **POST**: No summary

### /rpc/st_removerepeatedpoints
- **GET**: args: geom, tolerance - Returns a version of a geometry with duplicate points removed.
- **POST**: args: geom, tolerance - Returns a version of a geometry with duplicate points removed.

### /rpc/st_scale
- **GET**: args: geom, factor, origin - Scales a geometry by given factors.
- **POST**: args: geom, factor, origin - Scales a geometry by given factors.

### /rpc/st_segmentize
- **GET**: args: geog, max_segment_length - Return a modified geometry/geography having no segment longer than the given distance.
- **POST**: args: geog, max_segment_length - Return a modified geometry/geography having no segment longer than the given distance.

### /rpc/st_setsrid
- **GET**: args: geom, srid - Set the SRID on a geometry.
- **POST**: args: geom, srid - Set the SRID on a geometry.

### /rpc/st_sharedpaths
- **GET**: args: lineal1, lineal2 - Returns a collection containing paths shared by the two input linestrings/multilinestrings.
- **POST**: args: lineal1, lineal2 - Returns a collection containing paths shared by the two input linestrings/multilinestrings.

### /rpc/st_shortestline
- **GET**: args: geom1, geom2 - Returns the 2D shortest line between two geometries
- **POST**: args: geom1, geom2 - Returns the 2D shortest line between two geometries

### /rpc/st_simplifypolygonhull
- **GET**: args: param_geom, vertex_fraction, is_outer = true - Computes a simplifed topology-preserving outer or inner hull of a polygonal geometry.
- **POST**: args: param_geom, vertex_fraction, is_outer = true - Computes a simplifed topology-preserving outer or inner hull of a polygonal geometry.

### /rpc/st_snap
- **GET**: args: input, reference, tolerance - Snap segments and vertices of input geometry to vertices of a reference geometry.
- **POST**: args: input, reference, tolerance - Snap segments and vertices of input geometry to vertices of a reference geometry.

### /rpc/st_snaptogrid
- **GET**: args: geomA, pointOrigin, sizeX, sizeY, sizeZ, sizeM - Snap all points of the input geometry to a regular grid.
- **POST**: args: geomA, pointOrigin, sizeX, sizeY, sizeZ, sizeM - Snap all points of the input geometry to a regular grid.

### /rpc/st_split
- **GET**: args: input, blade - Returns a collection of geometries created by splitting a geometry by another geometry.
- **POST**: args: input, blade - Returns a collection of geometries created by splitting a geometry by another geometry.

### /rpc/st_square
- **GET**: args: size, cell_i, cell_j, origin - Returns a single square, using the provided edge size and cell coordinate within the square grid space.
- **POST**: args: size, cell_i, cell_j, origin - Returns a single square, using the provided edge size and cell coordinate within the square grid space.

### /rpc/st_squaregrid
- **GET**: args: size, bounds - Returns a set of grid squares and cell indices that completely cover the bounds of the geometry argument.
- **POST**: args: size, bounds - Returns a set of grid squares and cell indices that completely cover the bounds of the geometry argument.

### /rpc/st_srid
- **GET**: args: g1 - Returns the spatial reference identifier for a geometry.
- **POST**: args: g1 - Returns the spatial reference identifier for a geometry.

### /rpc/st_subdivide
- **GET**: args: geom, max_vertices=256, gridSize = -1 - Computes a rectilinear subdivision of a geometry.
- **POST**: args: geom, max_vertices=256, gridSize = -1 - Computes a rectilinear subdivision of a geometry.

### /rpc/st_swapordinates
- **GET**: args: geom, ords - Returns a version of the given geometry with given ordinate values swapped.
- **POST**: args: geom, ords - Returns a version of the given geometry with given ordinate values swapped.

### /rpc/st_symdifference
- **GET**: args: geomA, geomB, gridSize = -1 - Computes a geometry representing the portions of geometries A and B that do not intersect.
- **POST**: args: geomA, geomB, gridSize = -1 - Computes a geometry representing the portions of geometries A and B that do not intersect.

### /rpc/st_symmetricdifference
- **POST**: No summary

### /rpc/st_tileenvelope
- **GET**: args: tileZoom, tileX, tileY, bounds=SRID=3857;LINESTRING(-20037508.342789 -20037508.342789,20037508.342789 20037508.342789), margin=0.0 - Creates a rectangular Polygon in Web Mercator (SRID:3857) using the XYZ tile system.
- **POST**: args: tileZoom, tileX, tileY, bounds=SRID=3857;LINESTRING(-20037508.342789 -20037508.342789,20037508.342789 20037508.342789), margin=0.0 - Creates a rectangular Polygon in Web Mercator (SRID:3857) using the XYZ tile system.

### /rpc/st_touches
- **GET**: No summary
- **POST**: No summary

### /rpc/st_transform
- **GET**: args: geom, from_proj, to_srid - Return a new geometry with coordinates transformed to a different spatial reference system.
- **POST**: args: geom, from_proj, to_srid - Return a new geometry with coordinates transformed to a different spatial reference system.

### /rpc/st_triangulatepolygon
- **GET**: args: geom - Computes the constrained Delaunay triangulation of polygons
- **POST**: args: geom - Computes the constrained Delaunay triangulation of polygons

### /rpc/st_unaryunion
- **GET**: args: geom, gridSize = -1 - Computes the union of the components of a single geometry.
- **POST**: args: geom, gridSize = -1 - Computes the union of the components of a single geometry.

### /rpc/st_union
- **GET**: args: g1, g2, gridSize - Computes a geometry representing the point-set union of the input geometries.
- **POST**: args: g1, g2, gridSize - Computes a geometry representing the point-set union of the input geometries.

### /rpc/st_voronoilines
- **GET**: args: g1, tolerance, extend_to - Returns the boundaries of the Voronoi diagram of the vertices of a geometry.
- **POST**: args: g1, tolerance, extend_to - Returns the boundaries of the Voronoi diagram of the vertices of a geometry.

### /rpc/st_voronoipolygons
- **GET**: args: g1, tolerance, extend_to - Returns the cells of the Voronoi diagram of the vertices of a geometry.
- **POST**: args: g1, tolerance, extend_to - Returns the cells of the Voronoi diagram of the vertices of a geometry.

### /rpc/st_within
- **GET**: No summary
- **POST**: No summary

### /rpc/st_wkbtosql
- **GET**: No summary
- **POST**: No summary

### /rpc/st_wkttosql
- **GET**: No summary
- **POST**: No summary

### /rpc/st_wrapx
- **GET**: args: geom, wrap, move - Wrap a geometry around an X value.
- **POST**: args: geom, wrap, move - Wrap a geometry around an X value.

### /rpc/sync_group_conversation_participants
- **POST**: No summary

### /rpc/unlockrows
- **POST**: args: auth_token - Removes all locks held by an authorization token.

### /rpc/update_activity_statuses
- **POST**: No summary

### /rpc/update_expired_activities
- **POST**: No summary

### /rpc/updategeometrysrid
- **POST**: args: catalog_name, schema_name, table_name, column_name, srid - Updates the SRID of all features in a geometry column, and the table metadata.

### /spatial_ref_sys
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /stories
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /unread_message_counts
- **GET**: No summary

### /user_interests
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /user_skills
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /verification_requests
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

### /volunteer_reviews
- **GET**: No summary
- **POST**: No summary
- **DELETE**: No summary
- **PATCH**: No summary

