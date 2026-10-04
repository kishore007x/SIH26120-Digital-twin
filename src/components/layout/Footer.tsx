import { Link } from 'react-router-dom';
import { useTwin } from '../../store/twinStore';
import { FIELD_NAV, INFO_NAV, OPS_NAV, WELL_NAV } from '../../lib/navConfig';
import { fmtSimTime } from '../../lib/format';

export function Footer() {
  const wellId = useTwin((s) => s.wellId);
  const simTime = useTwin((s) => s.simTime);
  return (
    <footer className="site-footer">
      <div className="mx-auto grid max-w-[1600px] grid-cols-1 gap-6 px-6 py-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="foot-h">About this portal</div>
          <p className="text-[12px] leading-relaxed text-[#f1dcc4]">
            A demonstration digital twin for heavy-oil wells produced by cyclic steam stimulation (CSS) and sucker-rod pumps (SRP). It links thermal decline, oil viscosity and rod load, recommends a safe pump speed, and runs supervised automation with a safety gate and human override.
          </p>
        </div>
        <div>
          <div className="foot-h">Field operations</div>
          <ul className="space-y-1">
            {[FIELD_NAV[0], OPS_NAV, ...FIELD_NAV.slice(1)].map((n) => (
              <li key={n.key}>
                <Link to={n.path('')} className="foot-link">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="foot-h">Well analysis · {wellId}</div>
          <ul className="space-y-1">
            {WELL_NAV.map((n, i) => (
              <li key={n.key}>
                <Link to={n.path(wellId)} className="foot-link">
                  {i + 1}. {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="foot-h">Help & policies</div>
          <ul className="space-y-1">
            {INFO_NAV.map((n) => (
              <li key={n.key}>
                <Link to={n.path('')} className="foot-link">
                  {n.label}
                </Link>
              </li>
            ))}
            <li>
              <Link to="/help#accessibility" className="foot-link">
                Accessibility statement
              </Link>
            </li>
            <li>
              <Link to="/help#disclaimer" className="foot-link">
                Disclaimer & data notice
              </Link>
            </li>
            <li>
              <Link to="/help#shortcuts" className="foot-link">
                Keyboard shortcuts
              </Link>
            </li>
            <li>
              <Link to="/help#credits" className="foot-link">
                Image credits (CC licences)
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-6 py-3 text-[11.5px] text-[#e2c6a8]">
          <span>
            <b className="text-[#f3c77a]">Disclaimer:</b> demonstration prototype with simulated data. Not an official system of any government body or operating company, and not validated against field data.
          </span>
          <span className="ml-auto whitespace-nowrap">Simulated time: {fmtSimTime(simTime)} IST</span>
        </div>
      </div>
    </footer>
  );
}
