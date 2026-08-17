package librarypanels

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

func TestLibraryPanelModelFromSources(t *testing.T) {
	t.Run("prefers __elements model when present", func(t *testing.T) {
		uid := "panel-uid"
		libraryPanels := simplejson.NewFromAny(map[string]any{
			uid: map[string]any{
				"model": map[string]any{
					"type":  "timeseries",
					"title": "From elements",
				},
			},
		})
		panel := simplejson.NewFromAny(map[string]any{
			"type":  "text",
			"title": "Embedded",
			"libraryPanel": map[string]any{
				"uid":  uid,
				"name": "Shared",
			},
		})

		model, ok := libraryPanelModelFromSources(libraryPanels, panel, uid)
		require.True(t, ok)
		require.Equal(t, "timeseries", model.Get("type").MustString())
		require.Equal(t, "From elements", model.Get("title").MustString())
	})

	t.Run("falls back to embedded panel model for legacy provisioned JSON", func(t *testing.T) {
		uid := "legacy-uid"
		panel := simplejson.NewFromAny(map[string]any{
			"type":  "text",
			"title": "Legacy Panel",
			"options": map[string]any{
				"content": "hello",
			},
			"libraryPanel": map[string]any{
				"uid":  uid,
				"name": "Legacy Panel",
			},
		})

		model, ok := libraryPanelModelFromSources(simplejson.New(), panel, uid)
		require.True(t, ok)
		require.Equal(t, "text", model.Get("type").MustString())
		require.Equal(t, "Legacy Panel", model.Get("title").MustString())
		require.Equal(t, "hello", model.Get("options").Get("content").MustString())
	})

	t.Run("does not invent a model for library-panel-ref stubs", func(t *testing.T) {
		uid := "stub-uid"
		panel := simplejson.NewFromAny(map[string]any{
			"type":  "library-panel-ref",
			"title": "Stub",
			"libraryPanel": map[string]any{
				"uid":  uid,
				"name": "Stub",
			},
		})

		model, ok := libraryPanelModelFromSources(simplejson.New(), panel, uid)
		require.False(t, ok)
		require.Nil(t, model)
	})
}

func TestIsUsableEmbeddedLibraryPanelModel(t *testing.T) {
	require.True(t, isUsableEmbeddedLibraryPanelModel("timeseries"))
	require.True(t, isUsableEmbeddedLibraryPanelModel("text"))
	require.False(t, isUsableEmbeddedLibraryPanelModel(""))
	require.False(t, isUsableEmbeddedLibraryPanelModel("library-panel-ref"))
	require.False(t, isUsableEmbeddedLibraryPanelModel("row"))
}
