package dashboards

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
)

type libraryPanelServiceStub struct {
	unresolved []string
	err        error
	called     bool
	dash       *simplejson.Json
}

func (s *libraryPanelServiceStub) ImportLibraryPanelsForDashboard(context.Context, identity.Requester, *simplejson.Json, []any, int64, string) error {
	return nil
}

func (s *libraryPanelServiceStub) EnsureLibraryPanelsForProvisionedDashboard(_ context.Context, _ identity.Requester, dash *simplejson.Json, _ int64, _ string) ([]string, error) {
	s.called = true
	s.dash = dash
	return s.unresolved, s.err
}

func TestEnsureLibraryPanels(t *testing.T) {
	t.Run("no-ops when library panel service is nil", func(t *testing.T) {
		fr := &FileReader{
			Cfg: &config{Name: "default"},
			log: log.New("test"),
		}
		dash := &dashboards.SaveDashboardDTO{
			OrgID: 1,
			Dashboard: &dashboards.Dashboard{
				Data: simplejson.NewFromAny(map[string]any{"title": "t"}),
			},
		}
		require.NoError(t, fr.ensureLibraryPanels(context.Background(), dash))
	})

	t.Run("calls library panel service and tolerates unresolved UIDs", func(t *testing.T) {
		stub := &libraryPanelServiceStub{unresolved: []string{"missing-uid"}}
		fr := &FileReader{
			Cfg:                 &config{Name: "default"},
			log:                 log.New("test"),
			libraryPanelService: stub,
		}
		dash := &dashboards.SaveDashboardDTO{
			OrgID: 1,
			Dashboard: &dashboards.Dashboard{
				UID:   "dash-1",
				Title: "Dash",
				Data:  simplejson.NewFromAny(map[string]any{"title": "Dash"}),
			},
		}
		require.NoError(t, fr.ensureLibraryPanels(context.Background(), dash))
		require.True(t, stub.called)
	})
}
